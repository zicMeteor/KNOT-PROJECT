import { useEffect, useState } from "react"
import Button from "../ui/Button"
import Feedback from "../ui/Feedback"
import { CategoryPicker, TagEditor } from "./EditFields"
import { hostOf } from "../../lib/contentMeta"
import { reducedMotion } from "../../lib/threadGraph"
import styles from "./AnalysisResult.module.css"

// 요약이 써지는 속도: 한 번에 몇 글자, 몇 ms마다
const TYPE_CHARS = 2
const TYPE_MS = 18

// 두 태그 목록이 같은지 (순서·대소문자 무시)
function sameTags(a, b) {
  const x = a.map((t) => t.toLowerCase()).sort()
  const y = b.map((t) => t.toLowerCase()).sort()
  return x.length === y.length && x.every((t, i) => t === y[i])
}

// AI가 제안한 분석 결과. 저장을 누르기 전까지는 아무것도 바뀌지 않는다
// 카테고리와 태그는 저장 전에 고칠 수 있다. onEdit({ category } 또는 { tags })
// chipsRef: 태그 칩이 든 요소 (오른쪽 그래프로 날아가는 연출에 쓴다) / known: 이미 쓰는 태그
function AnalysisResult({ analysis, saving, onSave, onCancel, onEdit, known, chipsRef }) {
  const hasNewTag = analysis.tags.some((t) => t.is_new)
  const summary = analysis.summary ?? ""
  const suggested = analysis.suggested
  const edited =
    !!suggested &&
    (suggested.category !== analysis.category ||
      !sameTags(
        suggested.tags,
        analysis.tags.map((t) => t.name)
      ))

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
      <span className={styles.ai}>
        {edited ? "AI 제안을 고쳤습니다. 고친 값으로 저장합니다" : "AI 제안. 확인하고, 필요하면 고친 뒤 저장하세요"}
      </span>
      {(analysis.analysis_status === "ai_short" || analysis.truncated || analysis.via === "paste") && (
        <div className={styles.badges}>
          {analysis.via === "paste" && <span>붙여 넣은 글로 분석</span>}
          {analysis.analysis_status === "ai_short" && <span>짧은 본문으로 분석 ({analysis.char_count}자)</span>}
          {analysis.truncated && <span>긴 글이라 앞부분만 분석</span>}
        </div>
      )}
      <span className={styles.src}>{analysis.url ?? "PDF"}</span>
      <h2 className={styles.title}>{analysis.title ?? hostOf(analysis.url)}</h2>
      {/* 스크린리더에는 처음부터 전체 요약을 읽힌다 */}
      <p className={styles.summary} aria-label={summary}>
        <span aria-hidden="true">{summary.slice(0, shown)}</span>
      </p>

      <dl className={styles.kv}>
        <dt>카테고리</dt>
        <dd>
          <CategoryPicker value={analysis.category} onChange={(category) => onEdit({ category })} disabled={saving} />
        </dd>
        <dt>태그</dt>
        <dd>
          <TagEditor
            tags={analysis.tags}
            onChange={(tags) => onEdit({ tags })}
            known={known}
            chipsRef={chipsRef}
            disabled={saving}
          />
        </dd>
      </dl>

      <p className={styles.note}>
        {analysis.tags.length === 0
          ? "태그가 없으면 그래프에 보이지 않고, 전체 자료에서만 찾을 수 있습니다. "
          : hasNewTag
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
      <Feedback
        target="analysis"
        refValue={analysis.url ?? analysis.title}
        detail={{
          category: suggested?.category ?? analysis.category,
          tags: suggested?.tags ?? analysis.tags.map((t) => t.name),
          source: analysis.source,
        }}
        label="AI 분석 결과가 적절했나요?"
      />
    </section>
  )
}

export default AnalysisResult
