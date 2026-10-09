import { useEffect, useState } from "react"
import Button from "./ui/Button"
import ContentDetail from "./ContentDetail"
import { categoryColor } from "../constants/categories"
import styles from "./ContentListView.module.css"

function tagName(t) {
  return typeof t === "string" ? t : t.name
}

// 출처: 주소가 있으면 도메인만 (www. 제외), 없으면 PDF로 올린 자료
function sourceLabel(url) {
  if (!url) return "PDF"
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

// "2026-10-07T11:41:41" → "2026.10.07"
// 시간대 변환 없이 문자열에서 날짜만 잘라 쓴다 (Date로 바꾸면 시간대 때문에 하루 밀릴 수 있다)
function formatDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""))
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null
}

// 공통: 자료 목록 → 클릭하면 상세 → [목록으로]
// items: 보여줄 자료 / header: 목록 위에 둘 내용(건수, 안내 등) / renderBadge: 제목 옆 표시(일치 방식 등)
// 카드 안 정보 순서: 제목 > 출처 줄(작게) > 요약 > 태그(글자)
// 알약 모양은 누를 수 있는 것에만 쓰고, 태그처럼 정보만 있는 것은 글자로 둔다
// compact: 한 줄 목록 (제목 + 출처 + 날짜만). 자료 추가 화면의 최근 자료처럼 훑어보는 곳에서 쓴다
function ContentListView({ items, header, renderBadge, compact = false }) {
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
            목록으로
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
        {items.map((c) => {
          const date = formatDate(c.createdAt)
          if (compact) {
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`${styles.item} ${styles.itemCompact}`}
                  onClick={() => setSelected(c)}
                >
                  <span className={styles.compactTitle}>{c.title || c.url || "제목 없음"}</span>
                  <span className={`${styles.meta} ${styles.compactMeta}`}>
                    <span>{sourceLabel(c.url)}</span>
                    {date && <span>{date}</span>}
                  </span>
                </button>
              </li>
            )
          }
          return (
            <li key={c.id}>
              <button type="button" className={styles.item} onClick={() => setSelected(c)}>
                <span className={styles.titleRow}>
                  <span className={styles.itemTitle}>{c.title || c.url || "제목 없음"}</span>
                  {renderBadge?.(c)}
                </span>
                <span className={styles.meta}>
                  {c.category && (
                    <span className={styles.metaCategory}>
                      <span
                        className={styles.dot}
                        style={{ background: categoryColor(c.category) }}
                        aria-hidden="true"
                      />
                      {c.category}
                    </span>
                  )}
                  <span>{sourceLabel(c.url)}</span>
                  {date && <span>{date}</span>}
                </span>
                {c.summary && <span className={styles.summary}>{c.summary}</span>}
                {c.tags?.length > 0 && (
                  <span className={styles.tags}>
                    {c.tags.map((t) => (
                      <span key={tagName(t)} className={styles.tag}>
                        #{tagName(t)}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

export default ContentListView