// 서랍: 목록을 벗어나지 않고 자료 하나를 자세히 본다
// 같은 태그를 가진 자료를 누르면 이 서랍에서 이어서 열고, 지나온 자료는 위쪽 경로에 남는다
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { pdfFileUrl, reanalyzeContent } from "../../api/content"
import { categoryColor } from "../../constants/categories"
import { useAuth } from "../../hooks/useAuth"
import { dayOf, fullDay, hostOf, isUnanalyzed, kindOf, knownTags, sharedTags, tagName } from "../../lib/contentMeta"
import ContentEditForm from "./ContentEditForm"
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
// onUpdate(id, fields): 고치기 (Promise) / onUpload(id, file): PDF 원본 올리기 (Promise)
function ContentDrawer({ trail, contents, onGo, onClose, onDelete, onUpdate, onUpload }) {
  const navigate = useNavigate()
  const closeRef = useRef(null)
  // 삭제 확인: { id, step } (step 1 = 첫 확인, 2 = 마지막 확인). 다른 자료로 넘어가면 확인은 저절로 닫힌다
  const [confirm, setConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  // 고치기: { id, initial, ai } (ai = 다시 분석한 결과로 열었는지). 다른 자료로 넘어가면 저절로 닫힌다
  const [edit, setEdit] = useState(null)
  // 다시 분석·PDF 올리기는 시작한 자료 번호로 기억한다 (다른 자료로 넘어가도 그 자료에 진행 표시·오류가 붙지 않게)
  const [analyzingId, setAnalyzingId] = useState(null)
  const [uploadingId, setUploadingId] = useState(null)
  const [actionError, setActionError] = useState(null) // { id, text }
  const analyzeAbortRef = useRef(null)
  const fileInputRef = useRef(null)
  // 다시 분석 뒤 메뉴의 AI 사용 횟수를 새로 읽는다
  const refreshMe = useAuth()?.refresh
  const byId = useMemo(() => new Map(contents.map((c) => [c.id, c])), [contents])
  const known = useMemo(() => knownTags(contents), [contents])
  const current = byId.get(trail[trail.length - 1])
  const editing = !!current && edit?.id === current.id

  // 열리면 닫기 버튼에 초점
  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  // 고치는 중에 저장하지 않은 내용이 있는지 (고치기 화면이 알려 준다)
  const dirtyRef = useRef(false)
  const setDirty = useCallback((d) => {
    dirtyRef.current = d
  }, [])

  // 저장하지 않은 내용이 있으면 버릴지 묻는다. 버려도 되면 true
  const confirmDiscard = useCallback(
    () => !editing || !dirtyRef.current || window.confirm("고친 내용을 저장하지 않고 닫을까요?"),
    [editing]
  )

  // 바깥을 누르거나 닫기 버튼: 고치던 내용이 있으면 먼저 묻는다
  const requestClose = useCallback(() => {
    if (confirmDiscard()) onClose()
  }, [confirmDiscard, onClose])

  // Esc로 닫기. 고치는 중이면 고치기만 취소한다
  // 입력칸 안의 Esc는 그 칸에 맡긴다 (태그 자동완성 목록을 닫으려다 고친 내용을 잃지 않게)
  useEffect(() => {
    function onKey(e) {
      if (e.key !== "Escape") return
      if (editing) {
        if (e.target.closest?.("input, textarea, select")) return
        if (confirmDiscard()) setEdit(null)
      } else {
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, editing, confirmDiscard])

  // 서랍을 닫으면 진행 중인 다시 분석을 멈춘다
  useEffect(() => () => analyzeAbortRef.current?.abort(), [])

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

  const step = confirm?.id === current.id ? confirm.step : 0
  const unanalyzed = isUnanalyzed(current)
  const analyzing = analyzingId === current.id
  const uploading = uploadingId === current.id
  const editError = actionError?.id === current.id ? actionError.text : null

  function startEdit() {
    setActionError(null)
    setConfirm(null)
    setEdit({
      id: current.id,
      ai: false,
      initial: {
        title: current.title ?? "",
        category: current.category ?? "기타",
        tags: tags.map((name) => ({ name, is_new: false })),
        memo: current.memo ?? "",
      },
    })
  }

  // AI 없이 저장한 자료를 다시 분석해서, 결과를 고치기 화면에 채운다 (저장은 사용자가 누를 때)
  async function reanalyze() {
    const id = current.id
    const base = current
    const ctrl = new AbortController()
    analyzeAbortRef.current = ctrl
    setAnalyzingId(id)
    setActionError(null)
    setConfirm(null)
    try {
      const r = await reanalyzeContent(id, ctrl.signal)
      refreshMe?.()
      setEdit({
        id,
        ai: true,
        initial: {
          title: r.title || base.title || "",
          category: r.category,
          tags: r.tags,
          memo: base.memo ?? "",
          summary: r.summary,
          analysisStatus: r.analysis_status,
        },
      })
    } catch (e) {
      if (e.name !== "AbortError") setActionError({ id, text: e.message })
    } finally {
      analyzeAbortRef.current = null
      setAnalyzingId(null)
    }
  }

  // 원본이 없는 PDF 자료에 파일을 붙인다 (보관 기능 전에 저장했거나, 저장할 때 올리기에 실패한 자료)
  async function pickPdf(picked) {
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (!picked) return
    const id = current.id
    if (!picked.name.toLowerCase().endsWith(".pdf")) {
      setActionError({ id, text: "PDF 파일만 올릴 수 있습니다" })
      return
    }
    setUploadingId(id)
    setActionError(null)
    try {
      await onUpload(id, picked)
    } catch (e) {
      setActionError({ id, text: e.message })
    } finally {
      setUploadingId(null)
    }
  }

  // 경로를 눌러 다른 자료로 넘어갈 때도, 고치던 내용이 있으면 먼저 묻는다
  function goTo(id) {
    if (id === current.id) return
    if (!confirmDiscard()) return
    setEdit(null)
    onGo(id)
  }

  async function saveEdit(fields) {
    await onUpdate(current.id, fields)
    setEdit(null)
  }

  function askDelete() {
    setDeleteError(null)
    setConfirm({ id: current.id, step: 1 })
  }

  function cancelDelete() {
    setConfirm(null)
    setDeleteError(null)
  }

  async function confirmDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await onDelete(current.id)
      setConfirm(null)
    } catch (e) {
      setDeleteError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className={styles.scrim} onClick={requestClose} aria-hidden="true" />
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={current.title}>
        <div className={styles.head}>
          <nav className={styles.trail} aria-label="지나온 자료">
            {trail.map((id, i) => {
              const it = byId.get(id)
              const last = i === trail.length - 1
              return (
                <span key={id} className={styles.step}>
                  <button type="button" onClick={() => goTo(id)} aria-current={last ? "page" : undefined}>
                    {it?.title ?? "삭제된 자료"}
                  </button>
                  {!last && <span aria-hidden="true">/</span>}
                </span>
              )
            })}
          </nav>
          <button ref={closeRef} type="button" className={styles.close} onClick={requestClose} aria-label="서랍 닫기">
            <CloseIcon />
          </button>
        </div>

        {/* key: 다른 자료로 넘어갈 때마다 처음부터 다시 그리며 들어오는 연출을 다시 한다 */}
        <div key={current.id} className={styles.body}>
          {editing ? (
            <ContentEditForm
              initial={edit.initial}
              ai={edit.ai}
              requireMemo={unanalyzed && !edit.initial.analysisStatus}
              known={known}
              onSave={saveEdit}
              onCancel={() => setEdit(null)}
              onDirtyChange={setDirty}
            />
          ) : (
            <>
              <div className={styles.chips}>
                <span className={styles.chip}>
                  <span className={styles.dot} style={{ background: color }} />
                  {current.category ?? "기타"}, {kindOf(current.url).label}
                </span>
                {unanalyzed && <span className={styles.badge}>AI 분석 안 됨</span>}
              </div>
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
                {!current.url && current.hasFile && (
                  <a className={styles.primary} href={pdfFileUrl(current.id)} target="_blank" rel="noopener noreferrer">
                    원본 PDF 열기
                  </a>
                )}
                {!current.url && !current.hasFile && onUpload && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) => pickPdf(e.target.files?.[0])}
                      hidden
                    />
                    <button
                      type="button"
                      className={styles.primary}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? "올리는 중…" : "PDF 올리기"}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => navigate("/graph", { state: { category: current.category } })}
                >
                  그래프에서 보기
                </button>
                {onUpdate && (
                  <button type="button" className={styles.secondary} onClick={startEdit} disabled={analyzing}>
                    편집
                  </button>
                )}
                {/* 메모로만 저장한 자료는 AI로 다시 분석해 요약·분류를 채울 수 있다 (링크는 주소, PDF는 보관한 원본을 읽는다) */}
                {onUpdate && unanalyzed && (current.url || current.hasFile) && (
                  <button type="button" className={styles.secondary} onClick={reanalyze} disabled={analyzing}>
                    {analyzing ? "AI로 분석 중…" : "AI로 분석"}
                  </button>
                )}
                {onDelete && step === 0 && (
                  <button type="button" className={styles.danger} onClick={askDelete}>
                    삭제
                  </button>
                )}
              </div>

              {!current.url && !current.hasFile && (
                <p className={styles.note}>원본 PDF가 보관되어 있지 않습니다. 파일을 올리면 여기서 열어 볼 수 있습니다.</p>
              )}
              {editError && <p className={styles.editError}>{editError}</p>}

              {/* 두 번 확인한다. 마지막 확인에서는 버튼 자리를 바꿔, 같은 곳을 두 번 눌러도 지워지지 않게 한다 */}
              {step === 1 && (
                <div className={styles.confirm} role="alertdialog" aria-label="자료 삭제 확인 1/2">
                  <p>이 자료를 지울까요? 태그 연결도 함께 지워집니다.</p>
                  <div className={styles.confirmActions}>
                    <button type="button" className={styles.danger} onClick={() => setConfirm({ id: current.id, step: 2 })}>
                      계속
                    </button>
                    <button type="button" className={styles.secondary} onClick={cancelDelete}>
                      취소
                    </button>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div className={`${styles.confirm} ${styles.confirmFinal}`} role="alertdialog" aria-label="자료 삭제 확인 2/2">
                  <p>
                    정말 지울까요? <strong>「{current.title || hostOf(current.url)}」</strong>이(가) 영구히 지워지고{" "}
                    <strong>되돌릴 수 없습니다.</strong>
                  </p>
                  {deleteError && <p className={styles.confirmError}>{deleteError}</p>}
                  <div className={styles.confirmActions}>
                    <button type="button" className={styles.secondary} onClick={cancelDelete} disabled={deleting}>
                      취소
                    </button>
                    <button type="button" className={styles.dangerSolid} onClick={confirmDelete} disabled={deleting}>
                      {deleting ? "지우는 중…" : "영구 삭제"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  )
}

export default ContentDrawer
