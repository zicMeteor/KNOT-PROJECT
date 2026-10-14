# 본문 추출이 실패한 이유. ValueError를 이어받아서, v1처럼 ValueError만 잡는 곳도 그대로 동작한다
#
# FETCH_FAIL  페이지를 받지 못함 (접속 거부, 없는 주소, 시간 초과)
# LOGIN_WALL  로그인이 필요한 페이지로 보임 (추정)
# NO_TEXT     본문을 찾지 못함 (영상·이미지 위주, 또는 AI가 쓸 만한 글이 아니라고 판단)
# TOO_SHORT   본문이 너무 짧음
# PDF_NO_TEXT 글자가 없는 PDF (스캔본)
# PDF_LOCKED  암호가 걸린 PDF
# PDF_TOO_BIG 크기 초과
# DUPLICATE   이미 저장한 주소
class ExtractionError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
