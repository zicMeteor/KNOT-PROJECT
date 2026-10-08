import { useEffect, useState } from "react"
import Button from "./ui/Button"
import ContentDetail from "./ContentDetail"
import styles from "./ContentListView.module.css"

function tagName(t) {
  return typeof t === "string" ? t : t.name
}

// 공통: 자료 목록 → 클릭하면 상세 → [← 목록]
// items: 보여줄 자료 / header: 목록 위에 둘 내용(건수, 안내 등) / renderBadge: 제목 옆 표시(일치 방식 등)
function ContentListView({ items, header, renderBadge }) {
  const [selected, setSelected] = useState(null)

  // 목록이 바뀌면(다른 태그, 새 검색) 열려 있던 상세를 닫는다
  useEffect(() => {
    setSelected(null)
  }, [items])

  if (selected) {
    return (
      <div>
        <div className={styles.back}>
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            ← 목록
          </Button>
        </div>
        <ContentDetail content={selected} />
      </div>
    )
  }

  return (
    <>
      {header}
      <ul className={styles.list}>
        {items.map((c) => (
          <li key={c.id}>
            <button type="button" className={styles.item} onClick={() => setSelected(c)}>
              <span className={styles.titleRow}>
                <span className={styles.itemTitle}>{c.title || c.url || "제목 없음"}</span>
                {renderBadge?.(c)}
              </span>
              <span className={styles.muted}>{c.category}</span>
              {c.summary && <span className={styles.summary}>{c.summary}</span>}
              {c.tags?.length > 0 && (
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
  )
}

export default ContentListView