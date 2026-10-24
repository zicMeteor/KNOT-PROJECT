import { useEffect, useState } from "react"
import { fetchTagContents } from "../../api/graph"
import ContentListView from "./ContentListView"
import { logEvent } from "../../api/events"
import styles from "./TagPanel.module.css"

// 패널 자료를 불러오는 동안 보여 주는 빈 목록 모양
// 금방 끝나면 깜빡이지 않게, 조금 기다린 뒤에야 나타난다 (CSS의 animation-delay)
export function PanelLoading() {
  return (
    <div className={styles.loading} role="status">
      <span className="sr-only">불러오는 중…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className={styles.skeleton} aria-hidden="true">
          <i />
          <i />
        </div>
      ))}
    </div>
  )
}

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
      {!items && !error && <PanelLoading />}
      {error && <p className={styles.muted}>오류: {error}</p>}
      {items && (
        <ContentListView
          items={items}
          onOpen={(c) =>
            logEvent("graph_item_open", { content_id: c.id, tag, rank: items.indexOf(c) + 1, via: "tag" })
          }
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