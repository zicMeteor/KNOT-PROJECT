import { useEffect, useLayoutEffect, useRef, useState } from "react"
import styles from "./AiSearchBar.module.css"

// 부스에서 긴 글을 붙여넣어도 LLM에 그대로 보내지 않게 (질문 한두 문장이면 충분한 길이)
const MAX_LENGTH = 200
// 길게 쓰면 아래로 줄이 늘어나다가 이 줄 수를 넘으면 칸 안에서 스크롤한다
const MAX_ROWS = 4
// 글자를 모두 지운 뒤 이 시간(ms) 동안 다시 안 치면 결과를 지운다
// (새 질문을 쓰려고 지웠다가 바로 치는 경우에는 결과·카메라가 그대로 남는다)
const CLEAR_DELAY = 700

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
// loading: 찾는 중 / hasResult: 지울 결과(성공 또는 오류)가 있으면 true. 지우기 버튼을 보여준다
// onSubmit(query): 검색 실행 / onClear(): 결과와 강조 지우기
// initialText: 처음 입력칸에 넣어 둘 질문 (홈에서 넘겨받은 질문)
function AiSearchBar({ loading, hasResult, onSubmit, onClear, initialText = "", panelOpen = false }) {
  const [text, setText] = useState(initialText)
  const inputRef = useRef(null)
  const clearTimerRef = useRef(null) // 글자를 다 지웠을 때 결과를 지우는 타이머
  const onClearRef = useRef(onClear) // 타이머가 실행될 때 최신 onClear를 부르려고
  const query = text.trim()

  useLayoutEffect(() => {
    onClearRef.current = onClear
  })

  // 화면을 떠나면 남은 타이머를 정리한다
  useEffect(() => () => clearTimeout(clearTimerRef.current), [])
  
  // 찾는 중에는 포커스가 입력칸 밖에 있어도 Esc로 취소한다
  // (⏎ 버튼을 마우스로 누르면 버튼이 비활성화되면서 포커스가 사라져 입력칸의 Esc가 안 먹는다)
  useEffect(() => {
    if (!loading) return
    function handleWindowKeyDown(e) {
      if (e.key !== "Escape" || e.defaultPrevented) return
      if (e.target === inputRef.current) return // 입력칸 안의 Esc는 handleKeyDown이 처리한다
      clearTimeout(clearTimerRef.current)
      setText("")
      onClearRef.current()
    }
    window.addEventListener("keydown", handleWindowKeyDown)
    return () => window.removeEventListener("keydown", handleWindowKeyDown)
  }, [loading])

  // "/"를 누르면 검색창으로 간다. 다른 입력칸에서 글을 쓰는 중이거나 창(모달)이 열려 있으면 무시한다
  useEffect(() => {
    function handleSlash(e) {
      if (e.key !== "/" || e.defaultPrevented || e.isComposing) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || t.closest("input, textarea, select"))) return
      if (document.querySelector('[aria-modal="true"]')) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener("keydown", handleSlash)
    return () => window.removeEventListener("keydown", handleSlash)
  }, [])

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
    clearTimeout(clearTimerRef.current)
    onSubmit(query)
  }

  function handleSubmit(e) {
    e.preventDefault()
    submit()
  }

  // Enter는 검색, 줄바꿈은 넣지 않는다 (질문은 한 문장이라 줄바꿈이 필요 없다)
  // 한글 입력 중(조합 중) Enter는 글자 확정용이라 무시한다. 안 그러면 마지막 글자가 빠진 채 검색된다
  // Esc는 × 버튼과 같다 (글자, 결과, 강조를 모두 지운다. 찾는 중이면 취소)
  function handleKeyDown(e) {
    if (e.nativeEvent.isComposing) return
    if (e.key === "Escape") {
      e.preventDefault()
      handleClear()
      return
    }
    if (e.key !== "Enter") return
    e.preventDefault()
    if (!loading) submit()
  }

  // 붙여넣은 글의 줄바꿈은 띄어쓰기로 바꾼다
  // 글자를 모두 지우고 CLEAR_DELAY 동안 다시 안 치면 결과와 강조도 지운다
  // (찾는 중에는 입력칸이 읽기 전용이라 여기로 오지 않는다. 취소는 Esc·×로)
  function handleChange(e) {
    const next = e.target.value.replace(/[\r\n]+/g, " ")
    setText(next)
    clearTimeout(clearTimerRef.current)
    if (next.trim() === "" && hasResult) {
      clearTimerRef.current = setTimeout(() => onClearRef.current(), CLEAR_DELAY)
    }
  }

  // × 버튼·Esc: 바로 지운다. 지울 것이 없으면 아무것도 하지 않는다
  function handleClear() {
    clearTimeout(clearTimerRef.current)
    if (!text && !hasResult && !loading) return
    setText("")
    onClear()
  }

  return (
    <form className={`${styles.bar} ${panelOpen ? styles.barPanelOpen : ""}`} onSubmit={handleSubmit} role="search">
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
        readOnly={loading}
        placeholder="예: Transformer 관련 논문 보여줘"
        aria-label="AI로 자료 찾기"
        maxLength={MAX_LENGTH}
        enterKeyHint="search"
        aria-keyshortcuts="/"
      />
      {/* 비어 있고 포커스가 없을 때만 보이는 단축키 안내 (포커스 여부는 CSS가 판단한다) */}
      {!text && !loading && (
        <kbd className={styles.kbd} aria-hidden="true" title="/ 키로 검색창으로 이동">
          /
        </kbd>
      )}
      {(text || hasResult || loading) && (
        <button
          type="button"
          className={styles.clear}
          onClick={handleClear}
          aria-label={loading ? "검색 취소" : "검색 지우기"}
          title={loading ? "취소 (Esc)" : "지우기 (Esc)"}
        >
          ×
        </button>
      )}
      <button
        type="submit"
        className={styles.submit}
        disabled={!query || loading}
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
