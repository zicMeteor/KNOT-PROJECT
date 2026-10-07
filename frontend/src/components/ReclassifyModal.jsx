import { useState } from "react"
import { useReclassify } from "../hooks/useReclassify"
import styles from "./ReclassifyModal.module.css"

const EXAMPLES = [
  "학습으로 분류된 자료 중 도구 사용법에 가까운 것을 도구로 옮겨줘",
  "같은 개념인데 표기가 다른 태그를 하나로 통일해줘",
  "기타로 분류된 자료를 다시 검토해줘",
]

const STATUS_TEXT = "자료를 목적에 맞게 검토하는 중"

// 이 시간(초)이 지나면 "오래 걸리는 중" 문구를 보여준다
const SLOW_AFTER = 45

function ReclassifyModal({ onClose, onApplied }) {
  const {
    step,
    purpose,
    setPurpose,
    error,
    plan,
    result,
    elapsed,
    runPreview,
    cancelPreview,
    apply,
    backToInput,
  } = useReclassify({ onApplied, onClose })

  const [detailOpen, setDetailOpen] = useState(false)

  const changes = plan ? plan.actions.filter((a) => a.change_needed) : []
  const keepCount = plan ? plan.actions.length - changes.length : 0

  function titleOf(id) {
    const found = plan?.actions.find((a) => a.content_id === id)
    return found ? found.title : "#" + id
  }

  function handleClose() {
    if (step === "loading") cancelPreview()
    onClose()
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.title}>재분류</h2>

        {step === "input" && (
          <>
            <p className={styles.help}>
              목적을 적으면 최근 자료부터 일부를 검토해 변경안을 보여줍니다.
              적용 전에 확인 화면이 나옵니다.
            </p>
            <textarea
              className={styles.textarea}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={3}
              placeholder="재분류 목적을 입력하세요"
            />
            <div className={styles.examples}>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className={styles.example}
                  onClick={() => setPurpose(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <div className={styles.footer}>
              <button type="button" onClick={handleClose}>닫기</button>
              <button type="button" onClick={runPreview}>미리보기</button>
            </div>
          </>
        )}

        {step === "loading" && (
          <div className={styles.loading}>
            <div className={styles.progress}>
              <button
                type="button"
                className={styles.progressRow}
                onClick={() => setDetailOpen((open) => !open)}
                aria-expanded={detailOpen}
              >
                <span className={styles.dots} aria-hidden="true">
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </span>
                <span className={styles.progressText} role="status">
                  {STATUS_TEXT}
                </span>
                <span className={styles.progressTime}>{elapsed}초</span>
                <span
                  className={`${styles.chevron} ${detailOpen ? styles.chevronOpen : ""}`}
                  aria-hidden="true"
                >
                  ›
                </span>
              </button>

              {detailOpen && (
                <div className={styles.detail}>
                  <p className={styles.detailHead}>{elapsed}초 동안 작업 중입니다</p>
                  <p className={styles.detailBody}>
                    저장된 자료 중 최근 일부를 AI가 목적에 맞게 다시 판단하고
                    있습니다. 보통 15~30초 걸립니다. 이 단계에서는 자료가
                    바뀌지 않으며, 결과를 확인하고 [적용]을 눌러야 반영됩니다.
                  </p>
                </div>
              )}
            </div>

            {elapsed >= SLOW_AFTER && (
              <p className={styles.slow}>
                예상보다 오래 걸리고 있습니다. 계속 기다리거나 취소하고 다시 시도하세요.
              </p>
            )}
            <p className={styles.purposeEcho}>목적: {purpose}</p>
            <div className={styles.footer}>
              <button type="button" onClick={cancelPreview}>취소</button>
            </div>
          </div>
        )}

        {(step === "review" || step === "applying") && plan && (
          <>
            <p className={styles.help}>
              전체 {plan.total}건 중 {plan.reviewed}건 검토 · 변경 예정{" "}
              {changes.length}건 · 유지 {keepCount}건
            </p>
            {changes.length === 0 && <p>변경할 항목이 없습니다.</p>}
            <ul className={styles.list}>
              {changes.map((a) => (
                <li key={a.content_id} className={styles.item}>
                  <strong>{a.title}</strong>
                  <div>{a.current_category} → {a.category}</div>
                  <div className={styles.tags}>
                    {(a.current_tags ?? []).join(", ")} →{" "}
                    {(a.tags ?? []).join(", ")}
                  </div>
                  <div className={styles.reason}>{a.reason}</div>
                </li>
              ))}
            </ul>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <div className={styles.footer}>
              <button type="button" onClick={backToInput} disabled={step === "applying"}>
                다시 입력
              </button>
              <button type="button" onClick={handleClose} disabled={step === "applying"}>
                취소
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={step === "applying" || changes.length === 0}
              >
                {step === "applying" ? "적용 중…" : "적용"}
              </button>
            </div>
          </>
        )}

        {step === "result" && result && (
          <>
            <p className={styles.help}>
              {result.success_count}건 적용, {result.fail_count}건 실패
            </p>
            <ul className={styles.list}>
              {result.results
                .filter((r) => r.status === "failed")
                .map((r) => (
                  <li key={r.content_id} className={styles.item}>
                    <strong>{titleOf(r.content_id)}</strong>
                    <div className={styles.reason}>{r.reason}</div>
                  </li>
                ))}
            </ul>
            <div className={styles.footer}>
              <button type="button" onClick={onClose}>닫기</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ReclassifyModal