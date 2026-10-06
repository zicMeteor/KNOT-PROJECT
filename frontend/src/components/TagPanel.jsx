import { useEffect, useState } from "react"
import { fetchTagContents } from "../api/graph"
import styles from "./TagPanel.module.css"

function formatDate(s) {
  if (!s) return ""
  const d = new Date(s)
  return isNaN(d) ? s : d.toLocaleDateString("ko-KR")
}

function tagName(t) {
  return typeof t === "string" ? t : t.name
}

function TagPanel({ tag, onClose }) {
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
        if (!cancelled) setItems(list)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [tag])

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        {selected ? (
          <button onClick={() => setSelected(null)}>← 목록</button>
        ) : (
          <h2 className={styles.title}>{tag}</h2>
        )}
        <button onClick={onClose}>닫기</button>
      </div>

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

      {selected && (
        <div>
          <h3>{selected.title ?? selected.url}</h3>
          <p className={styles.muted}>
            {selected.category}
            {selected.createdAt && " · " + formatDate(selected.createdAt)}
          </p>
          <p className={styles.muted}>
            태그: {selected.tags.map(tagName).join(", ")}
          </p>
          <p className={styles.block}>{selected.summary}</p>
          {selected.memo && (
            <p className={styles.block}>메모: {selected.memo}</p>
          )}
          <a href={selected.url} target="_blank" rel="noopener noreferrer">
            원문 열기
          </a>
        </div>
      )}
    </aside>
  )
}

export default TagPanel