import re

import pymupdf

import settings
from pipeline.errors import ExtractionError

MIN_LENGTH = 300
SHORT_MIN = 80


def extract_pdf_text(pdf_path):
    """{"text", "short"}"""
    try:
        doc = pymupdf.open(pdf_path)
    except Exception as e:
        raise ExtractionError("NO_TEXT", f"PDF를 열 수 없습니다: {e}")

    try:
        if doc.needs_pass:
            raise ExtractionError("PDF_LOCKED", "암호가 걸린 PDF는 읽을 수 없습니다.")
        pages = []
        for page in doc:
            text = page.get_text()
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
