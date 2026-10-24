import ipaddress
import re
import socket
from urllib.parse import urljoin, urlsplit

import trafilatura
import urllib3
from playwright.sync_api import sync_playwright
from trafilatura.settings import use_config

import settings
from pipeline.errors import ExtractionError
from pipeline.PDF_parser import _clean_text

MIN_LENGTH = 300
# 실패 처리를 켰을 때: 이 길이 이상이면 짧은 본문이라도 분석해 본다 (제목·설명문 포함)
SHORT_MIN = 80
# 짧은 본문에 로그인하라는 말과 비밀번호 입력란이 함께 있으면 로그인 화면으로 본다 (추정이라 틀릴 수 있다)
# 메뉴의 '로그인' 한 단어만으로는 판단하지 않는다
LOGIN_HINTS = ("로그인", "log in", "login", "sign in", "signin")
PASSWORD_HINTS = ("비밀번호", "패스워드", "password")
# 주소의 경로 한 칸이나 도메인 한 마디가 통째로 이 말이면 로그인 화면으로 본다
# (author, oauth, login-tips처럼 일부만 겹치는 말은 제외한다)
LOGIN_URL_RE = re.compile(r"(?:^|[/.])(?:log-?in|sign-?in|sign_in|auth|accounts?)(?:[/.?#]|$)")


def _public_host(host):
    """True: 공개 주소, False: 이 컴퓨터·공유기·사내망 같은 안쪽 주소, None: 찾을 수 없는 주소"""
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except (OSError, UnicodeError):
        return None
    return all(ipaddress.ip_address(info[4][0].split("%")[0]).is_global for info in infos)


def _idna(host):
    """한글 도메인은 접속 라이브러리가 xn--로 바꿔 읽으므로, 비교할 때 같은 모양으로 맞춘다"""
    host = (host or "").strip("[]").lower().rstrip(".")
    try:
        return host.encode("idna").decode("ascii")
    except UnicodeError:
        return host


def _check_url(url):
    """서버가 사용자 대신 주소를 열기 때문에, 서버 안쪽을 가리키는 주소는 막는다.
    ALLOW_LOCAL_URLS를 켜면 검사하지 않는다 (내 컴퓨터에 띄운 페이지로 시험할 때)"""
    if settings.ALLOW_LOCAL_URLS:
        return
    parts = urlsplit(url or "")
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ExtractionError("BLOCKED_URL", "http나 https로 시작하는 웹 주소만 분석할 수 있습니다.")
    # 검사(urlsplit)와 실제 접속(urllib3)이 같은 주소를 다르게 읽는 틈을 막는다
    # 예: http://127.0.0.1\@example.com 은 검사에는 example.com, 접속은 127.0.0.1로 간다
    if "\\" in url or parts.username is not None or parts.password is not None:
        raise ExtractionError("BLOCKED_URL", "아이디·비밀번호나 역슬래시(\\)가 들어간 주소는 분석할 수 없습니다.")
    try:
        fetch_host = urllib3.util.parse_url(url).host or ""
    except ValueError:
        fetch_host = ""
    if _idna(fetch_host) != _idna(parts.hostname):
        raise ExtractionError("BLOCKED_URL", "주소를 해석할 수 없습니다. 주소를 다시 확인해 주세요.")
    public = _public_host(parts.hostname)
    if public is None:
        raise ExtractionError("FETCH_FAIL", "주소를 찾을 수 없습니다. 도메인을 확인해 주세요.")
    if not public:
        raise ExtractionError("BLOCKED_URL", "이 컴퓨터나 내부망을 가리키는 주소는 분석할 수 없습니다.")


def _route_guard():
    """Playwright에서 페이지가 부르는 스크립트·이미지·요청 가운데 안쪽 주소로 가는 것을 끊는다"""
    seen = {}

    def handle(route):
        host = urlsplit(route.request.url).hostname or ""
        if host not in seen:
            seen[host] = bool(host) and _public_host(host) is True
        if seen[host]:
            route.continue_()
        else:
            route.abort()

    return handle


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
                if not settings.ALLOW_LOCAL_URLS:
                    page.route("**/*", _route_guard())
                page.goto(url, timeout=settings.FETCH_TIMEOUT * 1000)
                html, final_url = page.content(), page.url
            finally:
                browser.close()
    except Exception as e:
        print(f"Playwright 실패: {e}")
        raise ExtractionError("FETCH_FAIL", "페이지를 불러오지 못했습니다 (접속이 막혔거나 시간이 초과됨)")
    # 리다이렉트로 안쪽 주소에 닿았으면 받은 내용을 버린다
    _check_url(final_url)
    return html, final_url


def _looks_like_login(text, final_url):
    low = (text or "").lower()
    if LOGIN_URL_RE.search((final_url or "").lower()):
        return True
    return any(h in low for h in LOGIN_HINTS) and any(h in low for h in PASSWORD_HINTS)


def extract_url_text(url):
    """{"text", "title", "short"}. short는 짧은 본문(제목·설명문을 더해 분석)인지

    실패 처리를 끄면 v1과 같다: 받기·추출에 실패하면 Playwright로 다시 시도하고, 300자 미만이면 실패.
    실패 처리를 켜면: 300자 미만일 때도 Playwright로 다시 시도하고, 그래도 짧으면 제목·설명문을
    더해 80자 이상이면 짧은 본문으로 분석한다.
    """
    assist = settings.FAILURE_ASSIST
    _check_url(url)
    response = trafilatura.fetch_response(url, decode=True, config=_config())
    html = None
    final_url = url
    if response and response.status == 200 and response.html:
        # 리다이렉트가 없으면 response.url이 '/글.html'처럼 경로만 오므로 처음 주소에 붙인다
        final_url = urljoin(url, response.url or "")
        # 리다이렉트로 안쪽 주소에 닿았으면 받은 내용을 버린다
        _check_url(final_url)
        html = response.html
    text = _extract(html)
    title, desc = _meta(html)

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
