import ContentListView from "./ContentListView"
import { logEvent } from "../../api/feedback"
import Feedback from "../ui/Feedback"
import styles from "./AiSearchPanel.module.css"

const MATCH_LABEL = {
  tag: "태그 일치",
  keyword: "키워드 일치",
  expanded: "관련 태그",
  category: "카테고리",
}

function tagName(t) {
  return typeof t === "string" ? t : t?.name ?? ""
}

// 이 자료의 태그 중 AI가 고른 태그와 같은 것 (대소문자 무시)
function matchedTags(item, aiTags) {
  const want = new Set(aiTags.map((t) => String(t).toLowerCase()))
  return (item.tags ?? []).map(tagName).filter((t) => want.has(t.toLowerCase()))
}

// 결과 카드의 일치 표시. 태그로 찾은 자료는 어떤 태그로 걸렸는지 보여준다
// 예: "#프로그래밍 일치", 여러 개면 "#Python 외 1 일치"
function badgeOf(item, aiTags) {
  if (item.matchType === "tag") {
    const hit = matchedTags(item, aiTags)
    if (hit.length > 0) {
      const more = hit.length > 1 ? ` 외 ${hit.length - 1}` : ""
      return { text: `#${hit[0]}${more} 일치`, title: hit.map((t) => "#" + t).join(" ") }
    }
  }
  const text = MATCH_LABEL[item.matchType] ?? item.matchType
  return { text, title: text }
}

// AI가 질문을 어떻게 해석했는지. 실제로 검색에 쓰인 것만 보여준다
// (태그·찾은 단어는 항상 쓰이고, 카테고리는 태그와 단어가 없을 때만 쓰인다)
function Interpretation({ analysis }) {
  if (!analysis) return null
  const tags = analysis.tags ?? []
  const keywords = analysis.keywords ?? []
  const categoryApplied = analysis.category_applied ?? analysis.categoryApplied ?? false

  const rows = []
  if (tags.length > 0) rows.push(["AI가 고른 태그", tags.map((t) => "#" + t)])
  if (keywords.length > 0) rows.push(["찾은 단어", keywords])
  if (categoryApplied && analysis.category) rows.push(["카테고리", [analysis.category]])
  if (rows.length === 0) return null

  return (
    <dl className={styles.interpret}>
      {rows.map(([label, values]) => (
        <div key={label} className={styles.interpretRow}>
          <dt className={styles.interpretLabel}>{label}</dt>
          <dd className={styles.interpretValues}>
            {values.map((v) => (
              <span key={v}>{v}</span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  )
}

// 오른쪽 사이드바의 AI 검색 결과. status/result/error는 useAiSearch에서 받는다
function AiSearchPanel({ status, result, error }) {
  if (status === "loading") {
    return (
      <div className={styles.panel}>
        <p className={styles.muted}>검색 중…</p>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className={styles.panel}>
        <p className={styles.error}>{error}</p>
      </div>
    )
  }

  if (!result) {
    return (
      <div className={styles.panel}>
        <p className={styles.muted}>
          그래프 아래 입력줄에 질문을 쓰면, 찾은 자료가 여기에 나오고 관련 노드가 밝아집니다.
        </p>
      </div>
    )
  }

  const items = result.contents
  const aiTags = result.analysis?.tags ?? []
  // 규칙 B: 결과가 모두 확장 검색으로만 나왔으면 그 사실을 알린다
  const onlyExpanded = items.length > 0 && items.every((c) => c.matchType === "expanded")

  const header = (
    <div className={styles.header}>
      <p className={styles.query}>“{result.query}”</p>
      <Interpretation analysis={result.analysis} />
      <p className={styles.muted}>찾은 자료 {result.count}건</p>
      <Feedback
        target="search"
        refValue={result.query}
        detail={{ count: result.count, tags: result.analysis?.tags ?? [] }}
        label="찾은 결과가 맞나요?"
      />
      {onlyExpanded && (
        <p className={styles.notice}>
          정확히 일치하는 자료가 없어 관련 태그로 찾은 결과입니다.
        </p>
      )}
    </div>
  )

  if (items.length === 0) {
    return (
      <div className={styles.panel}>
        {header}
        <p className={styles.muted}>찾은 자료가 없습니다. 다른 표현으로 질문해 보세요.</p>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <ContentListView
        items={items}
        header={header}
        onOpen={(c) =>
          logEvent("search_open", {
            query: result.query,
            content_id: c.id,
            rank: items.indexOf(c) + 1,
            match_type: c.matchType ?? null,
          })
        }
        renderBadge={(c) => {
          const badge = badgeOf(c, aiTags)
          return (
            <span className={styles.badge} title={badge.title}>
              {badge.text}
            </span>
          )
        }}
      />
    </div>
  )
}

export default AiSearchPanel