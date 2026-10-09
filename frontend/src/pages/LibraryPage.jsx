import { useMemo, useState } from "react"
import { useContents } from "../hooks/useContents"
import { useLibraryFilter } from "../hooks/useLibraryFilter"
import { categoryColor } from "../constants/categories"
import ContentListView from "../components/ContentListView"
import styles from "./LibraryPage.module.css"

// 즉시 검색: 저장한 전체 자료를 글자로 바로 걸러 본다 (LLM 호출 없음)
function LibraryPage() {
  const { contents, loading, error } = useContents()
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState(null) // null이면 전체
  const items = useLibraryFilter(contents, query, category)

  // 카테고리별 건수, 많은 순
  const categories = useMemo(() => {
    const counts = new Map()
    for (const c of contents) {
      if (c.category) counts.set(c.category, (counts.get(c.category) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [contents])

  // 이미 고른 카테고리를 다시 누르면 전체로 돌아간다
  function toggleCategory(name) {
    setCategory((cur) => (cur === name ? null : name))
  }

  const filtering = query.trim() !== "" || category != null

  let body
  if (loading) {
    body = <p className={styles.muted}>불러오는 중…</p>
  } else if (error) {
    body = <p className={styles.error}>{error}</p>
  } else if (contents.length === 0) {
    body = <p className={styles.muted}>아직 저장한 자료가 없습니다. 자료 추가에서 첫 자료를 넣어 보세요.</p>
  } else if (items.length === 0) {
    body = <p className={styles.muted}>일치하는 자료가 없습니다. 다른 단어로 찾아보세요.</p>
  } else {
    body = (
      <ContentListView
        items={items}
        header={
          <p className={styles.resultCount}>
            {filtering ? `${items.length}건 / 전체 ${contents.length}건` : `전체 ${contents.length}건`}
          </p>
        }
      />
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>전체 자료</h1>
        <p className={styles.lead}>단어를 입력하면 제목, 요약, 태그, 메모에서 바로 걸러 냅니다.</p>
      </header>

      <input
        type="search"
        className={styles.input}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="예: Transformer, 자율주행, JSON"
        aria-label="저장한 자료 검색"
        autoFocus
      />

      {categories.length > 0 && (
        <div className={styles.chips} role="group" aria-label="카테고리 필터">
          <button
            type="button"
            className={`${styles.chip} ${category == null ? styles.chipActive : ""}`}
            aria-pressed={category == null}
            onClick={() => setCategory(null)}
          >
            전체<span className={styles.count}>{contents.length}</span>
          </button>
          {categories.map(([name, n]) => (
            <button
              key={name}
              type="button"
              className={`${styles.chip} ${category === name ? styles.chipActive : ""}`}
              aria-pressed={category === name}
              onClick={() => toggleCategory(name)}
            >
              <span className={styles.dot} style={{ background: categoryColor(name) }} />
              {name}
              <span className={styles.count}>{n}</span>
            </button>
          ))}
        </div>
      )}

      <section className={styles.results}>{body}</section>
    </div>
  )
}

export default LibraryPage