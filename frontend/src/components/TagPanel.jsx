import { useEffect, useState } from "react"
import { fetchTagContents } from "../api/graph"
import Button from "./ui/Button"
import ContentDetail from "./ContentDetail"
import styles from "./TagPanel.module.css"

function tagName(t) {
  return typeof t === "string" ? t : t.name
}

// category가 있으면 그 카테고리 자료만 보여준다 (트리의 숫자와 맞추기 위해)
function TagPanel({ tag, category }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let cancelled = false
    setItems(null)
    setError(null)
    setSelected(null)
    fetchTagContents(tag)
      .then((list) => {
        if (!cancelled) {
          setItems(category ? list.filter((c) => c.category === category) : list)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [tag, category])

  return (
    <div className={styles.panel}>
      {selected && (
        <div className={styles.header}>
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            ← 목록
          </Button>
        </div>
      )}

      {!items && !error && <p>불러오는 중…</p>}
      {error && <p>오류: {error}</p>}

      {items && !selected && (
        <>
          <p className={styles.muted}>자료 {items.length}건</p>
          {items.length === 0 && <p>이 태그의 자료가 없습니다</p>}
          <ul className={styles.list}>
            {items.map((c) => (
              <li key={c.id}>
                <button className={styles.item} onClick={() => setSelected(c)}>
                  <span className={styles.itemTitle}>{c.title ?? c.url}</span>
                  <span className={styles.muted}>{c.category}</span>
                  {c.summary && (
                    <span className={styles.summary}>{c.summary}</span>
                  )}
                  {c.tags.length > 0 && (
                    <span className={styles.tags}>
                      {c.tags.map((t) => (
                        <span key={tagName(t)} className={styles.tag}>
                          {tagName(t)}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {selected && <ContentDetail content={selected} />}
    </div>
  )
}

export default TagPanel