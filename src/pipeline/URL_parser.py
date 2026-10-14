import trafilatura
from playwright.sync_api import sync_playwright
from trafilatura.settings import use_config

import settings
from pipeline.errors import ExtractionError
from pipeline.PDF_parser import _clean_text

MIN_LENGTH = 300
# 실패 처리를 켰을 때: 이 길이 이상이면 짧은 본문이라도 분석해 본다 (제목·설명문 포함)
SHORT_MIN = 80
# 짧은 본문에 이런 말이 있으면 로그인 화면으로 본다 (추정이라 틀릴 수 있다)
LOGIN_HINTS = ("로그인", "log in", "login", "sign in", "signin")
LOGIN_URL_HINTS = ("login", "signin", "sign_in", "auth", "accounts")


def _config():
    cfg = use_config()
    cfg.set("DEFAULT", "DOWNLOAD_TIMEOUT", str(settings.FETCH_TIMEOUT))
    return cfg


def _extract(html):
    if not html:
        return ""
    text = trafilatura.extract(html)
    return _clean_text(text) if text else ""


def _meta(html):
    """(제목, 설명문). 공유 미리보기에 쓰이는 정보라 본문을 막은 사이트도 열어 둔 경우가 많다"""
    if not html:
        return None, None
    m = trafilatura.extract_metadata(html)
    if not m:
        return None, None
    return m.title, m.description


def _render(url):
    """Playwright로 JS까지 실행한 HTML과 최종 주소. 실패하면 ExtractionError"""
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                page = browser.new_page()
                page.goto(url, timeout=settings.FETCH_TIMEOUT * 1000)
                return page.content(), page.url
            finally:
                browser.close()
    except Exception as e:
        print(f"Playwright 실패: {e}")
        raise ExtractionError("FETCH_FAIL", "페이지를 불러오지 못했습니다 (접속이 막혔거나 시간이 초과됨)")


def _looks_like_login(text, final_url):
    low = (text or "").lower()
    url = (final_url or "").lower()
    return any(h in url for h in LOGIN_URL_HINTS) or any(h in low for h in LOGIN_HINTS)


def extract_url_text(url):
    """{"text", "title", "short"}. short는 짧은 본문(제목·설명문을 더해 분석)인지

    실패 처리를 끄면 v1과 같다: 받기·추출에 실패하면 Playwright로 다시 시도하고, 300자 미만이면 실패.
    실패 처리를 켜면: 300자 미만일 때도 Playwright로 다시 시도하고, 그래도 짧으면 제목·설명문을
    더해 80자 이상이면 짧은 본문으로 분석한다.
    """
    assist = settings.FAILURE_ASSIST
    html = trafilatura.fetch_url(url, config=_config())
    text = _extract(html)
    title, desc = _meta(html)
    final_url = url

    if html is None or not text or (assist and len(text) < MIN_LENGTH):
        print("Trafilatura 실패 또는 본문 부족 → Playwright 재시도")
        try:
            html_js, final_url = _render(url)
        except ExtractionError:
            if html is None:
                raise
            html_js = None
        text_js = _extract(html_js)
        if len(text_js) > len(text):
            text = text_js
        t2, d2 = _meta(html_js)
        title, desc = title or t2, desc or d2

    if len(text) >= MIN_LENGTH:
        return {"text": text, "title": title, "short": False}

    if not assist:
        if not text:
            raise ExtractionError("NO_TEXT", "본문 추출 실패")
        raise ExtractionError("TOO_SHORT", f"추출된 텍스트가 너무 짧습니다 ({len(text)}자)")

    if _looks_like_login(text, final_url):
        raise ExtractionError("LOGIN_WALL", "로그인이 필요한 페이지로 보입니다. 본문을 복사해 붙여 넣어 주세요.")
    combined = "\n".join(x for x in (title, desc, text) if x)
    if len(combined) < SHORT_MIN:
        if not text:
            raise ExtractionError("NO_TEXT", "글이 거의 없는 페이지입니다 (영상·이미지 위주일 수 있습니다).")
        raise ExtractionError("TOO_SHORT", f"본문이 너무 짧습니다 ({len(text)}자).")
    return {"text": combined, "title": title, "short": True}
