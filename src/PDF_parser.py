import pymupdf
import re

from LLM_prompt import analyze_content

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
        raise ValueError("ValueError 발생") 
    
    pages = "\n".join(pages)
    return _clean_text(pages)

def _clean_text(text):
    # 줄 단위로 쪼개기
    text = text.splitlines()
    seen = set()
    result = []
    
    # 각 줄에 대해:
    #     앞뒤 공백 제거
    #     비어있지 않고 seen에 없으면:
    #         seen에 추가
    #         result에 추가
    for line in text:
        stripped = line.strip()
        
        if stripped and stripped not in seen:
            seen.add(stripped)
            result.append(stripped)
    
    # result를 줄바꿈으로 합치기
    result = "\n".join(result)
    text = re.sub(r"(\n\s*){3,}","\n\n",result)
    return text

if __name__ == "__main__":
    text = extract_pdf_text("테스트 PDF 경로를 입력하세요")
    print("텍스트 추출 완료")
    result = analyze_content(text, [])
    print("분석 완료")
    print(result)