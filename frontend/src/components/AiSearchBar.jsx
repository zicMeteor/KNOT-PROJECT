import { useLayoutEffect, useRef, useState } from "react"
import styles from "./AiSearchBar.module.css"

// 부스에서 긴 글을 붙여넣어도 LLM에 그대로 보내지 않게 (질문 한두 문장이면 충분한 길이)
const MAX_LENGTH = 200
// 길게 쓰면 아래로 줄이 늘어나다가 이 줄 수를 넘으면 칸 안에서 스크롤한다
const MAX_ROWS = 4

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

// 엔터(줄바꿈) 모양: 위에서 내려와 왼쪽으로 꺾이는 화살표
function EnterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 5v6a4 4 0 0 1-4 4H5" />
      <path d="m9 10-5 5 5 5" />
    </svg>
  )
}

// 그래프 화면 하단의 AI 검색창
// loading: 찾는 중 / hasResult: 결과가 있으면 지우기 버튼을 보여준다
// onSubmit(query): 검색 실행 / onClear(): 결과와 강조 지우기
function AiSearchBar({ loading, hasResult, onSubmit, onClear }) {
  const [text, setText] = useState("")
  const inputRef = useRef(null)
  const query = text.trim()

  // 글자가 칸을 넘으면 다음 줄로 넘어가도록 높이를 내용에 맞춘다 (최대 MAX_ROWS줄)
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = "auto"
    const cs = getComputedStyle(el)
    const lineHeight = parseFloat(cs.lineHeight) || 24
    const padding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
    el.style.height = Math.min(el.scrollHeight, lineHeight * MAX_ROWS + padding) + "px"
  }, [text])

  function submit() {
    if (!query) return
    onSubmit(query)
  }

  function handleSubmit(e) {
    e.preventDefault()
    submit()
  }

  // Enter는 검색, 줄바꿈은 넣지 않는다 (질문은 한 문장이라 줄바꿈이 필요 없다)
  // 한글 입력 중(조합 중) Enter는 글자 확정용이라 무시한다. 안 그러면 마지막 글자가 빠진 채 검색된다
  function handleKeyDown(e) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return
    e.preventDefault()
    submit()
  }

  // 붙여넣은 글의 줄바꿈은 띄어쓰기로 바꾼다
  function handleChange(e) {
    setText(e.target.value.replace(/[\r\n]+/g, " "))
  }

  function handleClear() {
    setText("")
    onClear()
  }

  return (
    <form className={styles.bar} onSubmit={handleSubmit} role="search">
      <span className={styles.icon}>
        <SearchIcon />
      </span>
      <textarea
        ref={inputRef}
        className={styles.input}
        rows={1}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="예: Transformer 관련 논문 보여줘"
        aria-label="AI로 자료 찾기"
        maxLength={MAX_LENGTH}
        enterKeyHint="search"
      />
      {(text || hasResult) && (
        <button
          type="button"
          className={styles.clear}
          onClick={handleClear}
          aria-label="검색 지우기"
          title="지우기"
        >
          ×
        </button>
      )}
      <button
        type="submit"
        className={styles.submit}
        disabled={!query}
        aria-label={loading ? "AI로 찾는 중" : "AI로 찾기"}
        aria-busy={loading}
        title="AI로 찾기 (Enter)"
      >
        {loading ? <span className={styles.spinner} aria-hidden="true" /> : <EnterIcon />}
      </button>
    </form>
  )
}

export default AiSearchBar