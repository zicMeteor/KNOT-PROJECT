import trafilatura
from PDF_parser import _clean_text
from LLM_prompt import analyze_content

MIN_LENGTH = 300

def extract_url_text(url):
    html = trafilatura.fetch_url(url)
    
    # html이 None이면:
    #     ValueError 발생 ("HTML 다운로드 실패")
    
    if html is None:
        raise ValueError("HTML 다운로드 실패")
    
    text = trafilatura.extract(html)
    
    if text is None:
        raise ValueError("본문 추출 실패")
    
    text = _clean_text(text)
    
    if len(text) < MIN_LENGTH:
        raise ValueError(f"추출된 텍스트가 너무 짧습니다 ({len(text)}자)")
    
    return text

# print("1. URL 추출 시작")

# text = extract_url_text("https://docs.python.org/3/tutorial/")

# print("2. URL 추출 완료")
# print(f"총 길이: {len(text)}자")

# print("3. LLM 호출 시작")

# result = analyze_content(text, [])

# print("4. LLM 호출 완료")
# print(result)

if __name__ == "__main__":
    text = extract_url_text("https://docs.python.org/3/tutorial/")
    print(text[:500])
    print(f"총 길이: {len(text)}자")
    print("LLM 호출 시작")
    result = analyze_content(text, [])
    print("LLM 호출 완료")
    print(result)