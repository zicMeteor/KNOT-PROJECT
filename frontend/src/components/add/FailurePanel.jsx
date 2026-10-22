// 분석에 실패했을 때: 이유를 알려 주고, 본문 붙여넣기 또는 메모 저장으로 이어 간다
// (서버에서 FAILURE_ASSIST를 켰을 때만 쓴다. 끄면 v1처럼 알림 한 줄만 보인다)
import { useEffect, useRef, useState } from "react"
import { analyzeText, saveContent } from "../../api/content"
import { hostOf } from "../../lib/contentMeta"
import Button from "../ui/Button"
import { CategoryPicker, TagEditor } from "./EditFields"
import { FAILURE_REASONS as REASONS } from "../../lib/failureReasons"
import { reducedMotion } from "../../lib/threadGraph"
import styles from "./FailurePanel.module.css"

// 붙여넣기 분석에 필요한 최소 글자 수 (서버와 같다)
const PASTE_MIN = 30
const MEMO_MAX = 2000

// 메모 저장 제목의 처음 값: 사이트 이름 + 경로 (사이트 이름만으로는 같은 사이트의 자료끼리 구분이 안 된다)
function titleFromUrl(url) {
  try {
    const u = new URL(url)
    const path = decodeURIComponent(u.pathname).replace(/\/+$/, "")
    const t = hostOf(url) + path
    return t.length > 80 ? t.slice(0, 80) + "…" : t
  } catch {
    return hostOf(url)
  }
}

// 붙여 넣은 글의 첫 줄 (제목을 비웠을 때 쓴다)
function firstLine(text) {
  const line = text.split("\n").map((l) => l.trim()).find(Boolean) ?? ""
  return line.length > 80 ? line.slice(0, 80) + "…" : line
}

// failure: { code, message, source: "url" | "pdf", url, filename } (message: 서버가 알려 준 실패 설명)
// memo: 분석 전에 적어 둔 메모 / known: 이미 쓰는 태그
// onAnalyzed(result): 붙여넣기 분석 결과 / onSaved(saved): 메모 저장 완료 / onRetry() / onClose()
// onBusy(bool): 붙여넣기 분석·메모 저장이 진행 중인지 (그동안 위쪽 입력칸을 잠근다)
function FailurePanel({ failure, memo: initialMemo, known, onAnalyzed, onSaved, onRetry, onClose, onUsage, onBusy }) {
  const reason = REASONS[failure.code]
  const isPdf = failure.source === "pdf"
  const canPaste = !!reason.paste && !isPdf
  const [mode, setMode] = useState("choose") // choose | paste | manual
  const [error, setError] = useState(null)
  const [busy, setBusyState] = useState(false)
  const abortRef = useRef(null)
  const panelRef = useRef(null)

  function setBusy(value) {
    setBusyState(value)
    onBusy?.(value)
  }

  // 패널이 화면 아래로 밀려 버튼이 안 보일 수 있어, 나타날 때 보이는 곳까지 스크롤한다
  useEffect(() => {
    panelRef.current?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" })
  }, [])

  // 붙여넣기
  const [text, setText] = useState("")
  const [pasteTitle, setPasteTitle] = useState("")

  // 메모 저장. 제목은 PDF면 파일 이름, 링크면 사이트 이름으로 미리 채운다
  const [title, setTitle] = useState(() =>
    isPdf ? (failure.filename ?? "").replace(/\.pdf$/i, "") : titleFromUrl(failure.url)
  )
  const [category, setCategory] = useState("기타")
  const [tags, setTags] = useState([])
  const [memo, setMemo] = useState(initialMemo ?? "")

  function go(next) {
    setError(null)
    setMode(next)
  }

  async function submitPaste(e) {
    e.preventDefault()
    const body = text.trim()
    if (body.length < PASTE_MIN) return
    const t = pasteTitle.trim() || firstLine(body)
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setError(null)
    try {
      const result = await analyzeText(body, failure.url, t, controller.signal)
      onUsage?.()
      onAnalyzed({ ...result, title: result.title ?? t })
    } catch (err) {
      if (err.name === "AbortError") return
      setError(err.message)
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }

  async function submitManual(e) {
    e.preventDefault()
    if (!title.trim() || !memo.trim()) return
    const content = {
      url: isPdf ? null : failure.url,
      source: failure.source,
      memo: memo.trim(),
      title: title.trim(),
      category,
      tags,
      summary: null,
      analysis_status: "manual",
      via: "manual",
    }
    setBusy(true)
    setError(null)
    try {
      const saved = await saveContent(content)
      // PDF 원본 올리기까지 끝날 때까지 잠가 둔다 (그사이 저장을 또 누르면 같은 자료가 두 번 생긴다)
      await onSaved({ ...content, content_id: saved.content_id })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section ref={panelRef} className={styles.panel} aria-labelledby="fail-title">
      <span className={styles.kicker}>분석하지 못했습니다</span>
      <h2 id="fail-title" className={styles.title}>
        {reason.title}
      </h2>
      {mode !== "manual" && (
        <p className={styles.help}>
          {reason.detail && failure.message ? `${failure.message} ${reason.help}` : reason.help}
        </p>
      )}
      <p className={styles.target}>{isPdf ? failure.filename : failure.url}</p>

      {mode === "choose" && (
        <div className={styles.actions}>
          {canPaste && (
            <Button variant="primary" onClick={() => go("paste")}>
              본문 붙여넣기
            </Button>
          )}
          {reason.retry && (
            <Button variant="primary" onClick={onRetry}>
              다시 시도
            </Button>
          )}
          <Button variant={canPaste || reason.retry ? "secondary" : "primary"} onClick={() => go("manual")}>
            메모 쓰고 저장
          </Button>
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </div>
      )}

      {mode === "paste" && (
        <form className={styles.form} onSubmit={submitPaste}>
          <label className={styles.label} htmlFor="fail-paste">
            페이지 본문
          </label>
          <textarea
            id="fail-paste"
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            rows={8}
            autoFocus
            placeholder="페이지에서 본문을 복사해 여기에 붙여 넣으세요"
          />
          <span className={styles.count}>
            {text.trim().length.toLocaleString()}자
            {text.trim().length < PASTE_MIN ? `, ${PASTE_MIN}자 이상 넣어야 분석합니다` : ""}
          </span>
          <label className={styles.label} htmlFor="fail-paste-title">
            제목 (선택)
          </label>
          <input
            id="fail-paste-title"
            className={styles.field}
            value={pasteTitle}
            onChange={(e) => setPasteTitle(e.target.value)}
            disabled={busy}
            maxLength={200}
            placeholder="비우면 붙여 넣은 글의 첫 줄을 씁니다"
          />
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <Button type="submit" variant="primary" disabled={busy || text.trim().length < PASTE_MIN}>
              {busy ? "분석 중…" : "AI로 분석"}
            </Button>
            {busy ? (
              <Button variant="secondary" onClick={() => abortRef.current?.abort()}>
                취소
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => go("choose")}>
                뒤로
              </Button>
            )}
          </div>
        </form>
      )}

      {mode === "manual" && (
        <form className={styles.form} onSubmit={submitManual}>
          <p className={styles.sub}>AI 없이 저장합니다. 나중에 찾을 수 있게 메모를 꼭 적어 주세요.</p>
          <label className={styles.label} htmlFor="fail-title-input">
            제목
          </label>
          <input
            id="fail-title-input"
            className={styles.field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            maxLength={200}
            required
          />
          <span className={styles.label}>카테고리</span>
          <CategoryPicker value={category} onChange={setCategory} disabled={busy} />
          <span className={styles.label}>태그 (선택)</span>
          <TagEditor tags={tags} onChange={setTags} known={known} disabled={busy} />
          <span className={styles.count}>
            {tags.length === 0
              ? "태그를 붙이면 그래프에서 다른 자료와 이어집니다. 없으면 전체 자료에서만 찾을 수 있습니다"
              : "저장하면 같은 태그를 가진 자료와 그래프에서 이어집니다"}
          </span>
          <label className={styles.label} htmlFor="fail-memo">
            메모 (필수)
          </label>
          <textarea
            id="fail-memo"
            className={styles.textarea}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            disabled={busy}
            rows={4}
            maxLength={MEMO_MAX}
            required
            placeholder="무슨 자료인지, 왜 저장하는지"
          />
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <Button type="submit" variant="primary" disabled={busy || !title.trim() || !memo.trim()}>
              {busy ? "저장 중…" : "저장"}
            </Button>
            <Button variant="secondary" onClick={() => go("choose")} disabled={busy}>
              뒤로
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

export default FailurePanel
