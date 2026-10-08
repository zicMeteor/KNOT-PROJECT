import ContentListView from "./ContentListView"
import styles from "./AiSearchPanel.module.css"

const MATCH_LABEL = {
  tag: "태그 일치",
  keyword: "키워드 일치",
  expanded: "관련 태그",
  category: "카테고리",
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
  // 규칙 B: 결과가 모두 확장 검색으로만 나왔으면 그 사실을 알린다
  const onlyExpanded = items.length > 0 && items.every((c) => c.matchType === "expanded")

  const header = (
    <div className={styles.header}>
      <p className={styles.query}>“{result.query}”</p>
      <p className={styles.muted}>찾은 자료 {result.count}건</p>
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
        renderBadge={(c) => (
          <span className={styles.badge}>{MATCH_LABEL[c.matchType] ?? c.matchType}</span>
        )}
      />
    </div>
  )
}

export default AiSearchPanel