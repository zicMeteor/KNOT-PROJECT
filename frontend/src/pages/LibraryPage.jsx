import { useCallback, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useContents } from "../hooks/useContents"
import { deleteContent } from "../api/content"
import { useLibraryFilter } from "../hooks/useLibraryFilter"
import { categoryColor } from "../constants/categories"
import { dayOf, shortDay } from "../lib/contentMeta"
import SavedDays from "../components/library/SavedDays"
import LibraryGrid from "../components/library/LibraryGrid"
import ContentDrawer from "../components/library/ContentDrawer"
import styles from "./LibraryPage.module.css"

// 서랍 경로에 남길 자료 수
const TRAIL_MAX = 5

// 즉시 검색: 저장한 전체 자료를 글자로 바로 걸러 본다 (LLM 호출 없음)
function LibraryPage() {
  const { contents, loading, error, reload } = useContents()
  const navigate = useNavigate()
  // 홈의 "목록으로" 칸에서 넘겨받은 검색어로 시작한다
  const location = useLocation()
  const [query, setQuery] = useState(location.state?.q ?? "")
  const [category, setCategory] = useState(null) // null이면 전체
  const [day, setDay] = useState(null) // "YYYY-MM-DD"면 그날 저장한 자료만
  const [threads, setThreads] = useState(true) // 관련 자료 연결 표시
  const [trail, setTrail] = useState([]) // 서랍에서 지나온 자료 id (비어 있으면 서랍이 닫힘)
  const inputRef = useRef(null)
  const openerRef = useRef(null) // 서랍을 연 카드 (닫으면 초점을 돌려준다)

  const matched = useLibraryFilter(contents, query, category)
  const items = useMemo(
    () => (day ? matched.filter((c) => dayOf(c.createdAt) === day) : matched),
    [matched, day]
  )

  // 카테고리별 건수, 많은 순
  const categories = useMemo(() => {
    const counts = new Map()
    for (const c of contents) {
      if (c.category) counts.set(c.category, (counts.get(c.category) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [contents])

  const q = query.trim()
  const filtering = q !== "" || category != null || day != null

  function clearQuery() {
    setQuery("")
    inputRef.current?.focus()
  }

  function clearAll() {
    setQuery("")
    setCategory(null)
    setDay(null)
  }

  function openItem(id) {
    openerRef.current = document.activeElement
    setTrail([id])
  }

  // 서랍 안에서 이어서 열기: 경로에 이미 있으면 거기까지 되돌아가고, 없으면 뒤에 붙인다
  const goItem = useCallback((id) => {
    setTrail((t) => {
      const at = t.indexOf(id)
      return at >= 0 ? t.slice(0, at + 1) : [...t, id].slice(-TRAIL_MAX)
    })
  }, [])

  const closeDrawer = useCallback(() => {
    setTrail([])
    openerRef.current?.focus?.()
  }, [])

  // 지운 자료는 서랍 경로에서 뺀다. 경로가 비면 서랍을 닫는다
  const removeItem = useCallback(
    async (id) => {
      await deleteContent(id)
      await reload()
      setTrail((t) => t.filter((x) => x !== id))
    },
    [reload]
  )

  let body
  if (loading) {
    body = <p className={styles.muted}>불러오는 중…</p>
  } else if (error) {
    body = <p className={styles.error}>{error}</p>
  } else if (contents.length === 0) {
    body = <p className={styles.muted}>아직 저장한 자료가 없습니다. 자료 추가에서 첫 자료를 넣어 보세요.</p>
  } else if (items.length === 0 && q) {
    // 검색 실패는 복구로 잇는다: 같은 검색어로 AI 검색, 또는 검색어 지우기
    body = (
      <div className={styles.none} role="status">
        <h2>{`'${q}' 검색 결과가 없습니다`}</h2>
        <p>
          목록 검색은 제목, 요약, 태그, 출처, 메모에 그 단어가 그대로 있어야 찾습니다. 뜻으로 찾으려면 AI
          검색을 쓰세요. 검색어는 그대로 넘어갑니다.
        </p>
        <div className={styles.row}>
          <button type="button" className={styles.btn} onClick={() => navigate("/graph", { state: { q } })}>
            {`AI로 '${q}' 관련 자료 찾기`}
          </button>
          <button type="button" className={styles.btnGhost} onClick={clearQuery}>
            검색어 지우기
          </button>
        </div>
      </div>
    )
  } else if (items.length === 0) {
    const why = [category && `${category} 카테고리`, day && `${shortDay(day)} 저장분`].filter(Boolean).join(", ")
    body = (
      <div className={styles.none} role="status">
        <h2>고른 조건에 맞는 자료가 없습니다</h2>
        <p>{why} 조건을 함께 만족하는 자료가 없습니다.</p>
        <div className={styles.row}>
          <button type="button" className={styles.btnGhost} onClick={clearAll}>
            조건 모두 해제
          </button>
        </div>
      </div>
    )
  } else {
    body = (
      <LibraryGrid
        items={items}
        query={query}
        threads={threads}
        paused={trail.length > 0}
        onOpen={openItem}
      />
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>전체 자료</h1>
        <p className={styles.lead}>저장한 자료를 단어로 바로 거릅니다. AI를 거치지 않아 즉시 바뀝니다.</p>
      </header>

      <div className={styles.tools}>
        <div className={styles.search}>
          <label htmlFor="library-q">자료 검색</label>
          <div className={styles.sbox}>
            <input
              ref={inputRef}
              id="library-q"
              type="search"
              className={styles.input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제목, 요약, 태그, 출처에 있는 단어. 예: Transformer, 컨테이너"
              autoComplete="off"
              autoFocus
            />
            {q && (
              <button type="button" className={styles.clear} onClick={clearQuery}>
                지우기
              </button>
            )}
          </div>
        </div>

        {categories.length > 0 && (
          <div className={styles.chips} role="group" aria-label="카테고리 필터">
            <button
              type="button"
              className={styles.chip}
              aria-pressed={category == null}
              onClick={() => setCategory(null)}
            >
              전체 {contents.length}
            </button>
            {categories.map(([name, n]) => (
              <button
                key={name}
                type="button"
                className={styles.chip}
                aria-pressed={category === name}
                onClick={() => setCategory((cur) => (cur === name ? null : name))}
              >
                <span className={styles.dot} style={{ background: categoryColor(name) }} />
                {name} {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {day && (
        <div className={styles.active}>
          <button type="button" className={styles.chip} aria-pressed="true" onClick={() => setDay(null)}>
            {shortDay(day)} 저장분 해제
          </button>
        </div>
      )}

      <SavedDays contents={contents} day={day} onPick={setDay} />

      {!loading && !error && contents.length > 0 && (
        <div className={styles.meta}>
          <span role="status">
            {filtering
              ? `검색 결과 ${items.length}건, 전체 자료 ${contents.length}건`
              : `전체 자료 ${contents.length}건, 최근에 넣은 순`}
          </span>
          {items.length > 0 && (
            <label className={styles.check}>
              <input type="checkbox" checked={threads} onChange={(e) => setThreads(e.target.checked)} />
              관련 자료 연결 표시
            </label>
          )}
        </div>
      )}

      <section className={styles.results} aria-label="자료 목록">
        {body}
      </section>

      {trail.length > 0 && (
        <ContentDrawer trail={trail} contents={contents} onGo={goItem} onClose={closeDrawer} onDelete={removeItem} />
      )}
    </div>
  )
}

export default LibraryPage
