import { useEffect, useState } from "react"
import { fetchTagContents } from "../../api/graph"
import ContentListView from "./ContentListView"
import styles from "./TagPanel.module.css"

// 태그 하나의 자료를 불러온다. category가 있으면 그 카테고리 자료만 (트리의 숫자와 맞추기 위해)
function TagPanel({ tag, category }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setItems(null)
    setError(null)
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
      {!items && !error && <p className={styles.muted}>불러오는 중…</p>}
      {error && <p className={styles.muted}>오류: {error}</p>}
      {items && (
        <ContentListView
          items={items}
          header={
            <p className={styles.muted}>
              {items.length === 0 ? "이 태그의 자료가 없습니다" : `자료 ${items.length}건`}
            </p>
          }
        />
      )}
    </div>
  )
}

export default TagPanel