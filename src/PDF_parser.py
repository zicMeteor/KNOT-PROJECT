import pymupdf
import re

from LLM_prompt import analyze_content

MIN_LENGTH = 300

def extract_pdf_text(pdf_path):
    doc = pymupdf.open(pdf_path)
    
    # 빈 리스트 pages 생성
    pages = []
    
    for page in doc:
        text = page.get_text()
        
        if text.strip():
            pages.append(text)
    
    # 문서 닫기
    doc.close()
    
    # pages가 비어있으면: -> ValueError 발생
    if not pages:
        raise ValueError("PDF에서 텍스트를 추출할 수 없음") 
    
    text = _clean_text("\n".join(pages))
    
    if len(text) < MIN_LENGTH:
            raise ValueError(f"추출된 텍스트가 너무 짧습니다 ({len(text)}자)")
    
    return text

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

if __name__ == "__main__":
    text = extract_pdf_text("테스트 PDF 경로를 입력하세요")
    print("텍스트 추출 완료")
    result = analyze_content(text, [])
    print("분석 완료")
    print(result)