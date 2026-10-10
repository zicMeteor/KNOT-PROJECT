import { useEffect, useState } from "react"
import Button from "../ui/Button"
import { categoryColor } from "../../constants/categories"
import { hostOf } from "../../lib/contentMeta"
import { reducedMotion } from "../../lib/threadGraph"
import styles from "./AnalysisResult.module.css"

// 요약이 써지는 속도: 한 번에 몇 글자, 몇 ms마다
const TYPE_CHARS = 2
const TYPE_MS = 18

// AI가 제안한 분석 결과. 저장을 누르기 전까지는 아무것도 바뀌지 않는다
// chipsRef: 태그 칩이 든 요소 (오른쪽 그래프로 날아가는 연출에 쓴다)
function AnalysisResult({ analysis, saving, onSave, onCancel, chipsRef }) {
  const hasNewTag = analysis.tags.some((t) => t.is_new)
  const summary = analysis.summary ?? ""

  // 요약이 한 글자씩 써진다 (동작 줄이기면 한 번에)
  const [shown, setShown] = useState(() => (reducedMotion() ? Infinity : 0))
  useEffect(() => {
    if (reducedMotion()) return
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= summary.length) {
          clearInterval(id)
          return Infinity
        }
        return n + TYPE_CHARS
      })
    }, TYPE_MS)
    return () => clearInterval(id)
  }, [summary])

  return (
    <section className={styles.card} aria-label="분석 결과">
      <span className={styles.ai}>AI 제안. 확인한 뒤 저장하세요</span>
      <span className={styles.src}>{analysis.url ?? "PDF"}</span>
      <h2 className={styles.title}>{analysis.title ?? hostOf(analysis.url)}</h2>
      {/* 스크린리더에는 처음부터 전체 요약을 읽힌다 */}
      <p className={styles.summary} aria-label={summary}>
        <span aria-hidden="true">{summary.slice(0, shown)}</span>
      </p>

      <dl className={styles.kv}>
        <dt>카테고리</dt>
        <dd>
          <span className={styles.chip}>
            <span className={styles.dot} style={{ background: categoryColor(analysis.category) }} />
            {analysis.category}
          </span>
        </dd>
        <dt>태그</dt>
        <dd ref={chipsRef}>
          {analysis.tags.map((t, i) => (
            <span
              key={t.name}
              data-tag={t.name.toLowerCase()}
              className={t.is_new ? `${styles.chip} ${styles.fresh}` : styles.chip}
              style={{ animationDelay: `${i * 120}ms` }}
            >
              {t.name}
              {t.is_new && <span className={styles.freshMark}>새 태그</span>}
            </span>
          ))}
        </dd>
      </dl>

      <p className={styles.note}>
        {hasNewTag
          ? "새 태그 표시가 없는 태그는 이미 저장한 자료에도 있어서, 저장하면 그 자료들과 바로 이어집니다. "
          : "모두 이미 있는 태그라, 저장하면 그 자료들과 바로 이어집니다. "}
        주소나 메모를 바꾸려면 취소한 뒤 다시 분석하세요.
      </p>

      <div className={styles.actions}>
        <Button variant="primary" onClick={onSave} disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          취소
        </Button>
      </div>
    </section>
  )
}

export default AnalysisResult
