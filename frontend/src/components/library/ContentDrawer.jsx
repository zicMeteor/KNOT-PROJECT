// 서랍: 목록을 벗어나지 않고 자료 하나를 자세히 본다
// 같은 태그를 가진 자료를 누르면 이 서랍에서 이어서 열고, 지나온 자료는 위쪽 경로에 남는다
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { categoryColor } from "../../constants/categories"
import { dayOf, fullDay, hostOf, kindOf, sharedTags, tagName } from "../../lib/contentMeta"
import styles from "./ContentDrawer.module.css"

// 같은 태그를 가진 자료를 몇 건까지 보여 줄지
const RELATED_COUNT = 5

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  )
}

// trail: 지나온 자료 id 목록 (마지막이 지금 보는 자료) / contents: 전체 자료
// onGo(id): 경로나 관련 자료를 눌렀을 때 / onClose(): 닫기 / onDelete(id): 삭제 (Promise)
function ContentDrawer({ trail, contents, onGo, onClose, onDelete }) {
  const navigate = useNavigate()
  const closeRef = useRef(null)
  // 삭제 확인을 띄운 자료 id. 다른 자료로 넘어가면 확인은 저절로 닫힌다
  const [confirmId, setConfirmId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const byId = useMemo(() => new Map(contents.map((c) => [c.id, c])), [contents])
  const current = byId.get(trail[trail.length - 1])

  // 열리면 닫기 버튼에 초점, Esc로 닫기
  useEffect(() => {
    closeRef.current?.focus()
    function onKey(e) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const related = useMemo(() => {
    if (!current) return []
    return contents
      .filter((o) => o.id !== current.id)
      .map((o) => ({ item: o, shared: sharedTags(current, o) }))
      .filter((x) => x.shared.length > 0)
      .sort((a, b) => b.shared.length - a.shared.length)
      .slice(0, RELATED_COUNT)
  }, [contents, current])

  if (!current) return null
  const color = categoryColor(current.category)
  const tags = (current.tags ?? []).map(tagName)

  function openInGraph(tag) {
    navigate("/graph", { state: { category: current.category, tag } })
  }

  const confirming = confirmId === current.id

  function askDelete() {
    setDeleteError(null)
    setConfirmId(current.id)
  }

  async function confirmDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await onDelete(current.id)
      setConfirmId(null)
    } catch (e) {
      setDeleteError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={current.title}>
        <div className={styles.head}>
          <nav className={styles.trail} aria-label="지나온 자료">
            {trail.map((id, i) => {
              const it = byId.get(id)
              const last = i === trail.length - 1
              return (
                <span key={id} className={styles.step}>
                  <button type="button" onClick={() => onGo(id)} aria-current={last ? "page" : undefined}>
                    {it?.title ?? "삭제된 자료"}
                  </button>
                  {!last && <span aria-hidden="true">/</span>}
                </span>
              )
            })}
          </nav>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="서랍 닫기">
            <CloseIcon />
          </button>
        </div>

        {/* key: 다른 자료로 넘어갈 때마다 처음부터 다시 그리며 들어오는 연출을 다시 한다 */}
        <div key={current.id} className={styles.body}>
          <span className={styles.chip}>
            <span className={styles.dot} style={{ background: color }} />
            {current.category ?? "기타"}, {kindOf(current.url).label}
          </span>
          <h2 className={styles.title}>{current.title || hostOf(current.url)}</h2>
          <span className={styles.meta}>
            {hostOf(current.url)}
            {dayOf(current.createdAt) && `, ${fullDay(dayOf(current.createdAt))}에 저장`}
          </span>
          {current.summary && <p className={styles.summary}>{current.summary}</p>}
          {current.memo && <p className={styles.memo}>메모: {current.memo}</p>}

          {tags.length > 0 && (
            <>
              <h3 className={styles.h3}>태그. 누르면 그래프에서 그 태그를 엽니다</h3>
              <div className={styles.tags}>
                {tags.map((t) => (
                  <button key={t} type="button" className={styles.tag} onClick={() => openInGraph(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}

          <h3 className={styles.h3}>같은 태그를 가진 자료. 누르면 이 서랍에서 이어서 엽니다</h3>
          <div className={styles.related}>
            {related.length === 0 ? (
              <span className={styles.none}>아직 같은 태그를 가진 자료가 없습니다.</span>
            ) : (
              related.map(({ item, shared }) => (
                <button key={item.id} type="button" onClick={() => onGo(item.id)}>
                  <span className={styles.dot} style={{ background: categoryColor(item.category) }} />
                  <span className={styles.relTitle}>{item.title}</span>
                  <span className={styles.relN}>태그 {shared.length}개 같음</span>
                </button>
              ))
            )}
          </div>

          <div className={styles.actions}>
            {current.url && (
              <a className={styles.primary} href={current.url} target="_blank" rel="noopener noreferrer">
                원문 열기
              </a>
            )}
            <button
              type="button"
              className={styles.secondary}
              onClick={() => navigate("/graph", { state: { category: current.category } })}
            >
              그래프에서 보기
            </button>
            {onDelete && !confirming && (
              <button type="button" className={styles.danger} onClick={askDelete}>
                삭제
              </button>
            )}
          </div>

          {confirming && (
            <div className={styles.confirm} role="alertdialog" aria-label="자료 삭제 확인">
              <p>
                이 자료를 지울까요? 태그 연결도 함께 지워지고, <strong>되돌릴 수 없습니다.</strong>
              </p>
              {deleteError && <p className={styles.confirmError}>{deleteError}</p>}
              <div className={styles.confirmActions}>
                <button type="button" className={styles.dangerSolid} onClick={confirmDelete} disabled={deleting}>
                  {deleting ? "지우는 중…" : "지우기"}
                </button>
                <button type="button" className={styles.secondary} onClick={() => setConfirmId(null)} disabled={deleting}>
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

export default ContentDrawer
