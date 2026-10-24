import { useEffect, useState } from "react"
import { fetchTagContents } from "../../api/graph"
import ContentListView from "./ContentListView"
import { logEvent } from "../../api/events"
import { PanelLoading } from "./TagPanel"
import styles from "./TagPanel.module.css"

function tagName(t) {
  return typeof t === "string" ? t : t?.name ?? ""
}

// 실 하나 = 두 태그를 함께 가진 자료
// 한 태그의 자료를 불러와서 다른 태그도 가진 것만 남긴다 (서버에 두 태그 검색이 없어서)
// category가 있으면 그 카테고리 자료만 (그래프의 실 굵기와 맞추기 위해)
// onPickTag(name): "각 태그 따로 보기"를 눌렀을 때
function PairPanel({ a, b, category, onPickTag }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchTagContents(a)
      .then((list) => {
        if (cancelled) return
        const want = String(b).toLowerCase()
        setError(null)
        setItems(
          list.filter(
            (c) =>
              (!category || c.category === category) &&
              (c.tags ?? []).some((t) => tagName(t).toLowerCase() === want)
          )
        )
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [a, b, category])

  // 다른 실을 누르면 이전 목록 대신 "불러오는 중"을 보여 준다
  const [prevKey, setPrevKey] = useState(`${a}|${b}|${category}`)
  const key = `${a}|${b}|${category}`
  if (prevKey !== key) {
    setPrevKey(key)
    setItems(null)
    setError(null)
  }

  return (
    <div className={styles.panel}>
      {!items && !error && <PanelLoading />}
      {error && <p className={styles.muted}>오류: {error}</p>}
      {items && (
        <ContentListView
          items={items}
          onOpen={(c) =>
            logEvent("graph_item_open", { content_id: c.id, tag: `${a}|${b}`, rank: items.indexOf(c) + 1, via: "pair" })
          }
          header={
            <p className={styles.muted}>
              {items.length === 0 ? "두 태그를 함께 가진 자료가 없습니다" : `함께 쓴 자료 ${items.length}건`}
            </p>
          }
        />
      )}
      <div className={styles.alt}>
        <span>각 태그 따로 보기</span>
        <div className={styles.altRow}>
          {[a, b].map((t) => (
            <button key={t} type="button" className={styles.altChip} onClick={() => onPickTag(t)}>
              #{t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PairPanel
