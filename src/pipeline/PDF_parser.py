import re
import threading

import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c

import settings
from pipeline.errors import ExtractionError

MIN_LENGTH = 300
SHORT_MIN = 80

# PDFium은 스레드 안전하지 않다. 분석 라우트는 동기 함수라 요청마다 다른 스레드에서 돌므로,
# PDF를 여는 것부터 닫는 것까지 한 번에 하나만 하게 묶는다 (잠금 없이 동시에 돌리면 페이지를 못 읽는다)
_PDFIUM_LOCK = threading.Lock()


def extract_pdf_text(pdf_path):
    """{"text", "short"}"""
    with _PDFIUM_LOCK:
        try:
            doc = pdfium.PdfDocument(pdf_path)
        except pdfium.PdfiumError as e:
            if e.err_code == pdfium_c.FPDF_ERR_PASSWORD:
                raise ExtractionError("PDF_LOCKED", "암호가 걸린 PDF는 읽을 수 없습니다.")
            raise ExtractionError("NO_TEXT", f"PDF를 열 수 없습니다: {e}")

        # 페이지와 글자 객체는 문서보다 먼저 닫는다 (Windows에서는 닫아야 임시 파일을 지울 수 있다)
        try:
            pages = []
            for i in range(len(doc)):
                page = doc[i]
                textpage = page.get_textpage()
                try:
                    text = textpage.get_text_range()
                finally:
                    textpage.close()
                    page.close()
                if text.strip():
                    pages.append(text)
        finally:
            doc.close()

    if not pages:
        raise ExtractionError("PDF_NO_TEXT", "글자를 읽을 수 없는 PDF입니다 (스캔본). 문자 인식은 지원하지 않습니다.")

    text = _clean_text("\n".join(pages))

    if len(text) >= MIN_LENGTH:
        return {"text": text, "short": False}
    if settings.FAILURE_ASSIST and len(text) >= SHORT_MIN:
        return {"text": text, "short": True}
    raise ExtractionError("TOO_SHORT", f"추출된 텍스트가 너무 짧습니다 ({len(text)}자)")


def _clean_text(text):
    # 줄 단위로 쪼개기
    lines = text.splitlines()
    result = []
    prev = None
    
    for line in lines:
        stripped = line.strip()
        if stripped and stripped != prev:
            result.append(stripped)
            prev = stripped
    
    text = "\n".join(result)
    text = re.sub(r"(\n\s*){3,}", "\n\n", text)
    return text
