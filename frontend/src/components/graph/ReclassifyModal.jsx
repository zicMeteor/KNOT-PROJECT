import { useEffect, useRef, useState } from "react"
import Feedback from "../ui/Feedback"
import { useReclassify } from "../../hooks/useReclassify"
import Button from "../ui/Button"
import { CATEGORY_COLORS } from "../../constants/categories"
import styles from "./ReclassifyModal.module.css"

const CATEGORIES = Object.keys(CATEGORY_COLORS)

// 한 번에 검토하는 수 (서버 REVIEW_LIMIT과 같아야 함)
const BATCH_SIZE = 15

// category가 있는 예시는 누르면 검토 범위도 그 카테고리로 바뀐다
const EXAMPLES = [
  { text: "시험 공부용으로 다시 분류해줘" },
  { text: "학습으로 분류된 자료 중 도구 사용법에 가까운 것을 도구로 옮겨줘", category: "학습" },
  { text: "같은 개념인데 표기가 다른 태그를 하나로 통일해줘" },
  { text: "기타로 분류된 자료를 다시 검토해줘", category: "기타" },
]

const STATUS_TEXT = "자료를 목적에 맞게 검토하는 중"

// 이 시간(초)이 지나면 "오래 걸리는 중" 문구를 보여준다
const SLOW_AFTER = 45

const NONE = new Set()

// 순서·대소문자와 무관하게 같은 태그 묶음인지
// (서버는 태그를 소문자 이름으로 찾아 기존 태그에 잇기 때문에, 'React → react'는 실제로 아무것도 바꾸지 않는다)
function sameTags(a, b) {
  const norm = (list) => [...new Set((list ?? []).map((t) => t.trim().toLowerCase()))].sort().join("\u0000")
  return norm(a) === norm(b)
}

function ReclassifyModal({ onClose, onApplied }) {
  const {
    step,
    purpose,
    setPurpose,
    category,
    setCategory,
    error,
    plan,
    result,
    elapsed,
    runPreview,
    nextBatch,
    cancelPreview,
    apply,
    backToInput,
  } = useReclassify({ onApplied, onClose })

  const [detailOpen, setDetailOpen] = useState(false)
  // 체크를 푼 안 (content_id). 어느 묶음(plan)의 선택인지 같이 둬서, 새 묶음을 받으면 다시 모두 고른 상태로 시작한다
  const [picks, setPicks] = useState({ plan: null, excluded: new Set() })
  const excluded = picks.plan === plan ? picks.excluded : NONE

  // 브라우저 기본 대화상자로 연다: Esc로 닫기, 포커스 가두기, 뒤 화면 막기를 브라우저가 맡는다
  const dialogRef = useRef(null)
  const purposeRef = useRef(null)
  // 닫으면 이 창을 연 버튼으로 포커스를 돌려준다
  const [opener] = useState(() => document.activeElement)
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    purposeRef.current?.focus()
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [opener])

  const applying = step === "applying"
  const changes = plan ? plan.actions.filter((a) => a.change_needed) : []
  const keepCount = plan ? plan.actions.length - changes.length : 0
  const pickedCount = changes.filter((a) => !excluded.has(a.content_id)).length
  const hasNext = !!plan?.next_before_id
  // 남은 자료가 15건보다 적으면 그 수만큼만 검토한다
  const nextLabel = hasNext ? `다음 ${Math.min(BATCH_SIZE, plan.remaining)}건` : ""
  const scopeName = category ?? "전체 자료"

  function titleOf(id) {
    const found = plan?.actions.find((a) => a.content_id === id)
    return found ? found.title : "#" + id
  }

  function handleClose() {
    if (step === "loading") cancelPreview()
    onClose()
  }

  // Esc: 적용하는 중에는 닫지 않는다. 닫을 때는 이 컴포넌트를 내려서 닫는다
  function handleCancel(e) {
    e.preventDefault()
    if (!applying) handleClose()
  }

  function toggle(id) {
    const next = new Set(excluded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicks({ plan, excluded: next })
  }

  function toggleAll() {
    const next = pickedCount === changes.length ? new Set(changes.map((a) => a.content_id)) : new Set()
    setPicks({ plan, excluded: next })
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.modal}
      aria-labelledby="reclassify-title"
      onCancel={handleCancel}
      onClose={handleClose}
    >
      <h2 id="reclassify-title" className={styles.title}>
        분류 다시 검토
      </h2>

      {step === "input" && (
        <>
          <p className={styles.help}>
            목적을 적으면 AI가 고른 범위에서 최근 자료부터 15건씩 검토해 바꿀 내용을
            보여 줍니다. 적용하기 전까지 자료는 바뀌지 않습니다.
          </p>
          <fieldset className={styles.scope}>
            <legend className={styles.scopeLabel}>검토 범위</legend>
            <div className={styles.scopeOptions}>
              {[null, ...CATEGORIES].map((c) => (
                <label key={c ?? "all"} className={styles.scopeOption}>
                  <input
                    type="radio"
                    name="reclassify-scope"
                    className={styles.srOnly}
                    checked={category === c}
                    onChange={() => setCategory(c)}
                  />
                  {c && (
                    <span
                      className={styles.scopeDot}
                      style={{ background: CATEGORY_COLORS[c] }}
                      aria-hidden="true"
                    />
                  )}
                  {c ?? "전체"}
                </label>
              ))}
            </div>
          </fieldset>
          <label className={styles.srOnly} htmlFor="reclassify-purpose">
            검토 목적
          </label>
          <textarea
            ref={purposeRef}
            id="reclassify-purpose"
            className={styles.textarea}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={3}
            placeholder="예: 시험 공부용으로 다시 분류해줘"
          />
          {/* 예시를 누르면 입력창이 그 문장으로 채워진다. 지금 입력과 같은 예시는 눌린 상태로 보인다 */}
          <div className={styles.examples} role="group" aria-label="목적 예시">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.text}
                type="button"
                className={styles.example}
                aria-pressed={purpose.trim() === ex.text}
                onClick={() => {
                  setPurpose(ex.text)
                  if (ex.category) setCategory(ex.category)
                }}
              >
                {ex.text}
              </button>
            ))}
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.footer}>
            <Button variant="ghost" onClick={handleClose}>
              닫기
            </Button>
            <Button variant="primary" onClick={() => runPreview()} disabled={!purpose.trim()}>
              미리보기
            </Button>
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
                <p className={styles.detailHead}>진행 안내</p>
                <p className={styles.detailBody}>
                  {scopeName}에서 최근 자료부터 15건을 AI가 목적에 맞게 다시
                  판단하고 있습니다. 보통 15~30초 걸립니다. 이 단계에서는 자료가
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
          <p className={styles.purposeEcho}>
            목적: {purpose}
            <br />
            범위: {scopeName}
          </p>
          <div className={styles.footer}>
            <Button variant="secondary" onClick={cancelPreview}>
              취소
            </Button>
          </div>
        </div>
      )}

      {(step === "review" || applying) && plan && (
        <>
          <p className={styles.help}>
            {scopeName} {plan.total}건 중 {plan.reviewed}건 검토 · 바꿀 안 {changes.length}건 · 유지{" "}
            {keepCount}건
            {hasNext && <> · 남은 자료 {plan.remaining}건</>}
          </p>
          {changes.length === 0 ? (
            <p className={styles.none}>바꿀 안이 없습니다. 검토한 {plan.reviewed}건은 지금 분류 그대로 둡니다.</p>
          ) : (
            <>
              <div className={styles.listHead}>
                <span>적용할 안을 고르세요. 체크를 풀면 그 자료는 그대로 둡니다.</span>
                <button type="button" className={styles.textBtn} onClick={toggleAll} disabled={applying}>
                  {pickedCount === changes.length ? "모두 해제" : "모두 선택"}
                </button>
              </div>
              <ul className={styles.list}>
                {changes.map((a) => {
                  const categoryChanged = a.category && a.category !== a.current_category
                  const tagsChanged = a.tags && !sameTags(a.current_tags, a.tags)
                  const picked = !excluded.has(a.content_id)
                  return (
                    <li key={a.content_id}>
                      <label className={picked ? styles.pick : `${styles.pick} ${styles.off}`}>
                        <input
                          type="checkbox"
                          className={styles.check}
                          checked={picked}
                          onChange={() => toggle(a.content_id)}
                          disabled={applying}
                        />
                        <span className={styles.pickBody}>
                          <strong className={styles.pickTitle}>{a.title}</strong>
                          {categoryChanged && (
                            <span>
                              {a.current_category} → {a.category}
                            </span>
                          )}
                          {tagsChanged && (
                            <span className={styles.tags}>
                              {(a.current_tags ?? []).join(", ")} → {a.tags.join(", ")}
                            </span>
                          )}
                          <span className={styles.reason}>{a.reason}</span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          {/* 안을 다 본 뒤에 묻는다 */}
          <div className={styles.feedback}>
            <Feedback
              target="reclassify"
              refValue={purpose}
              detail={{ reviewed: plan.reviewed, proposed: changes.length }}
              label="제안이 목적에 맞나요?"
            />
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {/* 15건을 내려 보지 않아도 적용할 수 있게 아래에 붙어 있다 */}
          <div className={styles.footer}>
            {changes.length > 0 && pickedCount === 0 && (
              <span className={styles.footHint} role="status">
                고른 안이 없습니다
              </span>
            )}
            <Button variant="ghost" onClick={backToInput} disabled={applying}>
              다시 입력
            </Button>
            <Button variant="secondary" onClick={handleClose} disabled={applying}>
              취소
            </Button>
            {/* 바꿀 것이 있으면 적용이 주 동작, 없으면 다음 15건이 주 동작 */}
            {changes.length > 0 ? (
              <>
                {hasNext && (
                  <Button variant="secondary" onClick={nextBatch} disabled={applying}>
                    적용 안 하고 {nextLabel}
                  </Button>
                )}
                <Button variant="primary" onClick={() => apply(excluded)} disabled={applying || pickedCount === 0}>
                  {applying ? "적용 중…" : `${pickedCount}건 적용`}
                </Button>
              </>
            ) : (
              hasNext && (
                <Button variant="primary" onClick={nextBatch}>
                  {nextLabel} 검토
                </Button>
              )
            )}
          </div>
        </>
      )}

      {step === "result" && result && (
        <>
          <p className={styles.help}>
            {result.fail_count === 0
              ? `${result.success_count}건 적용했습니다.`
              : `${result.success_count}건 적용, ${result.fail_count}건 실패`}
            {hasNext && ` 남은 자료 ${plan.remaining}건을 이어서 검토할 수 있습니다.`}
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
            <Button variant={hasNext ? "ghost" : "primary"} onClick={onClose}>
              닫기
            </Button>
            {hasNext && (
              <Button variant="primary" onClick={nextBatch}>
                {nextLabel} 검토
              </Button>
            )}
          </div>
        </>
      )}
    </dialog>
  )
}

export default ReclassifyModal
