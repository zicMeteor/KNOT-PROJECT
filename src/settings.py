# 실행 설정: .env에서 읽는다. 값을 비워 두면 v1과 똑같이 동작한다 (로그인 없음, 사용자 1명)
import os
from dotenv import load_dotenv

load_dotenv()


def _flag(name, default=False):
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _int(name, default):
    try:
        return int(os.getenv(name, "").strip())
    except ValueError:
        return default


# 로그인을 켠다. 끄면 모든 요청이 1번 사용자로 처리된다 (v1과 같음)
AUTH_ENABLED = _flag("AUTH_ENABLED")
# HTTPS 주소(Tailscale Funnel 등)로 열 때 켠다. 쿠키를 HTTPS에서만 보내게 한다
COOKIE_SECURE = _flag("COOKIE_SECURE")
# frontend/dist(빌드한 화면)를 이 서버가 함께 내보낸다. 주소 하나로 화면과 API를 연다
SERVE_FRONTEND = _flag("SERVE_FRONTEND")
# 실패 처리(짧은 본문 재시도, 붙여넣기, 메모 저장)를 켠다
FAILURE_ASSIST = _flag("FAILURE_ASSIST")

# AI에게 보내는 본문 길이 상한 (글자 수). 넘으면 앞부분만 보낸다
MAX_TEXT_CHARS = _int("MAX_TEXT_CHARS", 30000)
# PDF 파일 크기 상한 (MB)
MAX_PDF_MB = _int("MAX_PDF_MB", 20)
# 웹 페이지를 받아 올 때 기다리는 시간 (초)
FETCH_TIMEOUT = _int("FETCH_TIMEOUT", 15)

# 화면에 거는 링크 (AGPL-3.0: 인터넷으로 쓰는 사람에게 소스를 받을 곳을 알린다)
SOURCE_URL = os.getenv("SOURCE_URL", "https://github.com/zicMeteor/KNOT-PROJECT").strip()
SURVEY_URL = os.getenv("SURVEY_URL", "").strip()
