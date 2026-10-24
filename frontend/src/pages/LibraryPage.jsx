import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useContents } from "../hooks/useContents"
import { deleteContent, updateContent, uploadPdf } from "../api/content"
import { logEvent } from "../api/events"
import { searchWords, squash, useLibraryFilter } from "../hooks/useLibraryFilter"
import { useAiSearch } from "../hooks/useAiSearch"
import { categoryColor } from "../constants/categories"
import { dayOf, shortDay, tagName } from "../lib/contentMeta"
import SavedDays from "../components/library/SavedDays"
import LibraryGrid from "../components/library/LibraryGrid"
import ContentDrawer from "../components/library/ContentDrawer"
import styles from "./LibraryPage.module.css"

// 서랍 경로에 남길 자료 수
const TRAIL_MAX = 5
// 검색창 아래에 띄울 추천 태그 수
const SUGGEST_MAX = 6

// 즉시 검색: 저장한 전체 자료를 글자로 바로 걸러 본다 (LLM 호출 없음)
function LibraryPage() {
  const { contents, loading, error, reload } = useContents()
  const navigate = useNavigate()
  // 홈의 "목록으로" 칸에서 넘겨받은 검색어로 시작한다
  const location = useLocation()
  const [query, setQuery] = useState(location.state?.q ?? "")
  const [category, setCategory] = useState(null) // null이면 전체
  const [day, setDay] = useState(null) // "YYYY-MM-DD"면 그날 저장한 자료만
  const [threads, setThreads] = useState(false) // 관련 자료 연결 표시 (처음엔 꺼서 카드만 보이게)
  // 서랍에서 지나온 자료 id (비어 있으면 서랍이 닫힘). 다른 화면에서 자료 하나를 열어 달라고 넘겨받으면 그 자료로 시작한다
  const [trail, setTrail] = useState(() => (location.state?.open ? [location.state.open] : []))
  // 넘겨받은 "열 자료"는 한 번만 쓴다. 남겨 두면 새로고침·뒤로 가기 때마다 서랍이 다시 열린다 (검색어는 그대로 둔다)
  useEffect(() => {
    if (!location.state?.open) return
    const rest = { ...location.state }
    delete rest.open
    navigate(".", { replace: true, state: Object.keys(rest).length ? rest : null })
  }, [location.state, navigate])
  const inputRef = useRef(null)
  const openerRef = useRef(null) // 서랍을 연 카드 (닫으면 초점을 돌려준다)

  const matched = useLibraryFilter(contents, query, category)
  const items = useMemo(
    () => (day ? matched.items.filter((c) => dayOf(c.createdAt) === day) : matched.items),
    [matched, day]
  )
  // 검색어의 모든 단어가 들어간 자료가 없으면, 일부만 맞는 자료를 보여 주면서 Enter로 AI 검색을 권한다
  const noFull = matched.full != null && !items.some((c) => matched.full.has(c.id))

  // 태그 자동완성: 지금 치고 있는 마지막 단어가 들어간 태그를, 그 단어로 시작하는 태그 → 자료 많은 순으로
  const tagCounts = useMemo(() => {
    const counts = new Map()
    for (const c of contents) {
      for (const t of c.tags ?? []) counts.set(tagName(t), (counts.get(tagName(t)) ?? 0) + 1)
    }
    return [...counts.entries()]
  }, [contents])
  const lastWord = /\s$/.test(query) ? "" : (searchWords(query).at(-1) ?? "")
  const suggestions = useMemo(() => {
    if (!lastWord) return []
    return tagCounts
      .map(([name, n]) => ({ name, n, s: squash(name) }))
      .filter((t) => t.s.includes(lastWord) && t.s !== lastWord)
      .sort((a, b) => b.s.startsWith(lastWord) - a.s.startsWith(lastWord) || b.n - a.n || a.name.localeCompare(b.name))
      .slice(0, SUGGEST_MAX)
  }, [tagCounts, lastWord])
  const [sugOpen, setSugOpen] = useState(false) // 글자를 치면 열고, 고르거나 Esc·초점 이동으로 닫는다
  const [active, setActive] = useState(-1) // 방향키로 고른 추천 (-1이면 없음)
  const showSug = sugOpen && suggestions.length > 0

  // 추천 태그를 고르면 치던 단어를 "#태그"로 바꾼다 (띄어쓰기가 있는 태그는 붙여 쓴다. 검색은 띄어쓰기를 무시한다)
  function pickTag(name) {
    setQuery((cur) => cur.replace(/\S*$/, `#${name.replace(/\s+/g, "")}`))
    setSugOpen(false)
    setActive(-1)
  }

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

  // 글자로 못 찾으면 이 화면에서 AI로 다시 찾는다 (검색창에서 Enter를 눌렀을 때만. 칠 때마다 부르면 AI 사용 횟수가 금방 준다)
  const ai = useAiSearch()
  // AI 결과는 지금 검색어에 대한 것일 때만 쓴다. 검색어를 고치면 다시 글자 검색 결과로 돌아간다
  const aiResult = ai.result && ai.result.query === q ? ai.result : null
  const aiBusy = ai.status === "loading"
  // AI가 찾은 자료를 목록과 같은 카드로 보여 준다. 고른 카테고리·날짜 조건도 똑같이 건다
  const aiItems = useMemo(() => {
    if (!aiResult) return null
    const byId = new Map(contents.map((c) => [c.id, c]))
    return aiResult.contents
      .map((r) => byId.get(r.id))
      .filter((c) => c && (!category || c.category === category) && (!day || dayOf(c.createdAt) === day))
  }, [aiResult, contents, category, day])

  function runAi() {
    if (q && !aiBusy) ai.run(q)
  }

  // AI가 질문을 무엇으로 바꿨는지 한 줄로 (태그·핵심어)
  const aiTerms = aiResult
    ? [...(aiResult.analysis?.tags ?? []).map((t) => `#${t}`), ...(aiResult.analysis?.keywords ?? [])].join(", ")
    : ""

  function clearQuery() {
    setQuery("")
    inputRef.current?.focus()
  }

  function clearAll() {
    setQuery("")
    setCategory(null)
    setDay(null)
  }

  // 목록에서 자료를 열었다는 기록 (단어 검색·카테고리·날짜로 거른 상태였는지)
  // via: list = 글자 검색 목록, ai = 이 화면의 AI 검색 결과
  function openItem(id, via = "list", list = items) {
    openerRef.current = document.activeElement
    logEvent("library_open", {
      content_id: id,
      via,
      query: q || null,
      category: category ?? null,
      day: day ?? null,
      rank: list.findIndex((c) => c.id === id) + 1,
      shown: list.length,
    })
    setTrail([id])
  }

  // 서랍 안에서 이어서 열기: 경로에 이미 있으면 거기까지 되돌아가고, 없으면 뒤에 붙인다
  // 새 자료로 넘어가면 "같은 태그를 가진 자료"를 따라간 것으로 기록한다
  const goItem = useCallback((id) => {
    setTrail((t) => {
      if (!t.includes(id)) logEvent("library_open", { content_id: id, via: "related" })
      const at = t.indexOf(id)
      return at >= 0 ? t.slice(0, at + 1) : [...t, id].slice(-TRAIL_MAX)
    })
  }, [])

  const closeDrawer = useCallback(() => {
    setTrail([])
    openerRef.current?.focus?.()
  }, [])

  const updateItem = useCallback(
    async (id, fields) => {
      await updateContent(id, fields)
      await reload()
    },
    [reload]
  )

  const uploadItemPdf = useCallback(
    async (id, file) => {
      await uploadPdf(id, file)
      await reload()
    },
    [reload]
  )

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
  } else if (q && noFull && aiItems?.length > 0) {
    // 글자로는 모든 단어가 맞는 자료가 없어 Enter로 AI가 찾은 자료
    body = (
      <>
        <p className={styles.aiNote} role="status">
          {`검색어가 모두 들어간 자료는 없어서 AI로 찾았습니다. '${q}'를 `}
          <b>{aiTerms || "질문 그대로"}</b>
          {`(으)로 바꿔 찾은 자료 ${aiItems.length}건입니다.`}
        </p>
        <LibraryGrid
          items={aiItems}
          query=""
          threads={threads}
          paused={trail.length > 0}
          onOpen={(id) => openItem(id, "ai", aiItems)}
        />
      </>
    )
  } else if (items.length === 0 && q) {
    // 검색 실패는 복구로 잇는다: Enter로 이 화면에서 AI로 다시 찾기, 또는 검색어 지우기
    body = (
      <div className={styles.none} role="status">
        <h2>{aiResult ? `AI로도 '${q}' 관련 자료를 찾지 못했습니다` : `'${q}' 검색 결과가 없습니다`}</h2>
        <p>
          {aiResult
            ? `AI가 '${aiTerms || q}'(으)로 바꿔 찾았지만 맞는 자료가 없습니다. 다른 말로 찾아보세요.`
            : "목록 검색은 제목, 요약, 태그, 출처, 메모에 그 글자가 있어야 찾습니다. 검색창에서 Enter를 누르면 AI가 한글 발음이나 비슷한 말도 저장한 태그로 바꿔 이 화면에서 찾아 줍니다 (AI 사용 1회)."}
        </p>
        {ai.status === "error" && !aiResult && <p className={styles.error}>{ai.error}</p>}
        <div className={styles.row}>
          {aiBusy && (
            <button type="button" className={styles.btn} onClick={ai.cancel}>
              AI로 찾는 중… 취소
            </button>
          )}
          <button type="button" className={styles.btnGhost} onClick={() => navigate("/graph", { state: { q } })}>
            지식 그래프에서 AI로 찾기
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
      <>
        {q && noFull && (
          // 단어 일부만 맞는 자료를 보여 줄 때: 왜 이 자료들이 나왔는지와 AI로 더 찾는 방법
          <p className={styles.aiNote} role="status">
            {aiBusy
              ? "AI로 찾는 중…"
              : aiResult
                ? `AI로도 '${q}'에 맞는 자료를 찾지 못해, 검색어 일부가 들어간 자료를 보여 드립니다.`
                : "검색어가 모두 들어간 자료는 없어, 일부 단어가 들어간 자료를 보여 드립니다. Enter를 누르면 AI가 비슷한 말까지 찾아 줍니다 (AI 사용 1회)."}
          </p>
        )}
        {ai.status === "error" && q && noFull && !aiResult && <p className={styles.error}>{ai.error}</p>}
        <LibraryGrid
          items={items}
          query={query}
          threads={threads}
          paused={trail.length > 0}
          onOpen={openItem}
        />
      </>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>전체 자료</h1>
        <p className={styles.lead}>
          저장한 자료를 단어로 바로 찾습니다. 제목·태그·요약·메모에서 맞는 자료를 관련도순으로 보여 주고, 글자로 못 찾으면 Enter를 눌러 AI로 다시 찾을 수 있습니다.
        </p>
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
              onChange={(e) => {
                setQuery(e.target.value)
                setSugOpen(true)
                setActive(-1)
              }}
              onBlur={() => setSugOpen(false)}
              onKeyDown={(e) => {
                // 한글 조합 중의 키는 글자 확정이라 넘긴다
                if (e.nativeEvent.isComposing) return
                if (showSug && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                  e.preventDefault()
                  const n = suggestions.length
                  setActive((i) => (e.key === "ArrowDown" ? (i + 1) % n : i <= 0 ? n - 1 : i - 1))
                } else if (showSug && e.key === "Escape") {
                  e.preventDefault() // 검색창 기본 동작(검색어 지우기) 대신 추천만 닫는다
                  setSugOpen(false)
                } else if (e.key === "Enter") {
                  // 방향키로 고른 추천이 있으면 그 태그로, 없으면 모든 단어가 맞는 자료가 없을 때 AI로 찾는다
                  if (showSug && active >= 0) pickTag(suggestions[active].name)
                  else if (noFull && q) {
                    setSugOpen(false)
                    runAi()
                  }
                }
              }}
              placeholder="제목, 태그, 요약, 메모에 있는 단어. 못 찾으면 Enter로 AI 검색"
              autoComplete="off"
              autoFocus
              role="combobox"
              aria-expanded={showSug}
              aria-controls="library-sug"
              aria-autocomplete="list"
              aria-activedescendant={showSug && active >= 0 ? `library-sug-${active}` : undefined}
            />
            {showSug && (
              <ul id="library-sug" role="listbox" aria-label="추천 태그" className={styles.sug}>
                {suggestions.map((t, i) => (
                  <li
                    key={t.name}
                    id={`library-sug-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className={styles.sugItem}
                    // 누르는 순간 검색창 초점이 빠지면 목록이 먼저 닫히므로 초점 이동을 막는다
                    // 고르기는 클릭이 끝난 뒤에 한다 (누르는 순간 한글 조합이 확정되며 검색어를 덮어쓰지 않게)
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickTag(t.name)}
                    onMouseEnter={() => setActive(i)}
                  >
                    <span>#{t.name}</span>
                    <span className={styles.sugCount}>자료 {t.n}건</span>
                  </li>
                ))}
              </ul>
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
              ? `검색 결과 ${noFull && aiItems?.length ? `AI ${aiItems.length}` : items.length}건, 전체 자료 ${contents.length}건${q ? ", 관련도순" : ""}`
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
        <ContentDrawer
          trail={trail}
          contents={contents}
          onGo={goItem}
          onClose={closeDrawer}
          onDelete={removeItem}
          onUpdate={updateItem}
          onUpload={uploadItemPdf}
        />
      )}
    </div>
  )
}

export default LibraryPage
