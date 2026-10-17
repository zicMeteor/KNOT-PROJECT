import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { analyzePdf, analyzeUrl, logDiscard, saveContent } from "../api/content"
import { useAuth } from "../hooks/useAuth"
import { useContents } from "../hooks/useContents"
import { byNewest } from "../hooks/useLibraryFilter"
import { categoryColor } from "../constants/categories"
import { dayOf, hostOf, kindOf, shortDay, tagName } from "../lib/contentMeta"
import AnalysisResult from "../components/add/AnalysisResult"
import AddStage from "../components/add/AddStage"
import FailurePanel from "../components/add/FailurePanel"
import { isRecoverable } from "../lib/failureReasons"
import Button from "../components/ui/Button"
import Notice from "../components/ui/Notice"
import styles from "./AddPage.module.css"

// 아래쪽에 보여줄 최근 자료 개수. 전체는 "전체 자료" 페이지에서 본다
const RECENT_COUNT = 5
// "예시 링크로 해 보기"에 쓰는 주소
const SAMPLE_URL = "https://arxiv.org/abs/1706.03762"
// 분석이 이 시간(초)을 넘으면 더 걸릴 수 있다고 덧붙인다
const SLOW_AFTER = 15

// 주소만 보고 어떤 자료인지 미리 알려 준다 (분석 전, 서버를 부르지 않는다)
function previewText(url) {
  if (!/^https?:\/\/[^\s/]+\.[^\s]+/i.test(url)) return null
  const kind = kindOf(url)
  const label = kind.key === "post" ? "웹페이지" : kind.key === "paper" ? "논문 페이지" : kind.label
  return `${hostOf(url)}, ${label}로 보입니다. 분석 시작을 누르면 본문을 읽습니다`
}

// AI가 처음 제안한 카테고리·태그 (저장할 때 함께 보내 수정 여부를 기록한다)
function suggestedOf(result) {
  return { category: result.category, tags: (result.tags ?? []).map((t) => t.name) }
}

function AddPage() {
  const { contents, loading, error, reload } = useContents()

  // 최근 추가 순 (전체 자료 페이지와 같은 정렬 규칙)
  const recent = useMemo(() => [...contents].sort(byNewest).slice(0, RECENT_COUNT), [contents])
  // 이미 쓰는 태그 (소문자 → 이름). 태그를 고칠 때 새 태그인지 가리고, 고를 목록으로 보여 준다
  const known = useMemo(() => {
    const map = new Map()
    for (const c of contents) {
      for (const t of c.tags ?? []) {
        const name = tagName(t)
        if (!map.has(name.toLowerCase())) map.set(name.toLowerCase(), name)
      }
    }
    return map
  }, [contents])

  // 홈에서 넣은 링크는 받아서 바로 분석한다
  const location = useLocation()
  const navigate = useNavigate()
  const handoffUrl = location.state?.url

  const [mode, setMode] = useState("link") // 넣을 자료 종류: "link" | "pdf"
  const [url, setUrl] = useState(handoffUrl ?? "")
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [memo, setMemo] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [secs, setSecs] = useState(0) // 분석에 걸린 시간 (초)
  const [analysis, setAnalysis] = useState(null)
  // 분석 뒤 메뉴의 AI 사용 횟수를 새로 읽는다
  const auth = useAuth()
  const refreshMe = auth?.refresh
  // 서버에서 실패 처리를 켰을 때만, 실패하면 붙여넣기·메모 저장 패널을 띄운다
  const assist = !!auth?.me?.failure_assist
  const [failure, setFailure] = useState(null) // { code, source, url, filename }
  // 실패 패널에서 붙여넣기 분석·메모 저장을 하는 중인지
  const [failureBusy, setFailureBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null) // 방금 저장한 분석 결과 (저장 완료 화면용)
  const [notice, setNotice] = useState(null) // { type: "success" | "warn" | "error", text }
  const abortRef = useRef(null)
  const fileInputRef = useRef(null)
  const chipsRef = useRef(null)

  const phase = analyzing ? "busy" : analysis ? "result" : saved ? "saved" : "idle"

  function showError(e) {
    setNotice({
      type: e.code === "duplicate" ? "warn" : "error",
      text: e.message,
    })
  }

  // 분석하는 동안 걸린 시간을 센다
  useEffect(() => {
    if (!analyzing) return
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [analyzing])

  // 분석하는 동안 탭 제목에 진행 중임을 보여 준다
  useEffect(() => {
    if (!analyzing) return
    const prev = document.title
    document.title = "분석 중… · KNOT"
    return () => {
      document.title = prev
    }
  }, [analyzing])

  // 다른 탭에 가 있는 동안 분석이 끝나면 탭 제목으로 알리고, 돌아오면 원래대로 돌린다
  useEffect(() => {
    if (!analysis || !document.hidden) return
    const prev = document.title
    document.title = "✓ 분석 완료 · KNOT"
    function restore() {
      if (!document.hidden) document.title = prev
    }
    document.addEventListener("visibilitychange", restore)
    return () => {
      document.removeEventListener("visibilitychange", restore)
      document.title = prev
    }
  }, [analysis])

  function clearFile() {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function pickFile(picked) {
    if (!picked) return
    if (!picked.name.toLowerCase().endsWith(".pdf")) {
      setNotice({ type: "error", text: "PDF 파일만 선택할 수 있습니다" })
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }
    setNotice(null)
    setSaved(null)
    setFile(picked)
  }

  // overrideUrl: 예시 링크처럼 입력칸을 거치지 않고 바로 분석할 주소
  async function handleAnalyze(overrideUrl) {
    setNotice(null)
    setAnalysis(null)
    setSaved(null)
    setFailure(null)

    const usePdf = !overrideUrl && mode === "pdf"
    let u = ""
    if (usePdf) {
      if (!file) {
        setNotice({ type: "error", text: "PDF 파일을 먼저 고르세요" })
        return
      }
    } else {
      u = (overrideUrl ?? url).trim()
      if (!/^https?:\/\//i.test(u)) {
        setNotice({
          type: "error",
          text: "http:// 또는 https://로 시작하는 주소를 입력하세요",
        })
        return
      }
    }

    const controller = new AbortController()
    abortRef.current = controller
    setSecs(0)
    setAnalyzing(true)
    try {
      if (usePdf) {
        const result = await analyzePdf(file, controller.signal)
        setAnalysis({ ...result, url: null, source: "pdf", memo: memo, suggested: suggestedOf(result) })
      } else {
        const result = await analyzeUrl(u, memo, controller.signal)
        setAnalysis({ ...result, url: u, source: "url", memo: memo, suggested: suggestedOf(result) })
      }
      refreshMe?.()
    } catch (e) {
      if (e.name === "AbortError") return
      if (assist && isRecoverable(e.code)) {
        setFailure({ code: e.code, source: usePdf ? "pdf" : "url", url: usePdf ? null : u, filename: file?.name })
        if (e.code === "AI_QUOTA") refreshMe?.()
      } else {
        showError(e)
      }
    } finally {
      abortRef.current = null
      setAnalyzing(false)
    }
  }

  // 붙여 넣은 본문으로 분석이 끝났을 때: 평소 결과 화면으로 넘어간다
  function handlePasted(result) {
    setAnalysis({
      ...result,
      url: failure.url,
      source: "url",
      memo: memo,
      via: "paste",
      suggested: suggestedOf(result),
    })
    setFailure(null)
  }

  // AI 없이 메모로 저장했을 때
  async function handleManualSaved(content) {
    await reload()
    setSaved(content)
    setFailure(null)
    setUrl("")
    setMemo("")
    clearFile()
  }

  // 분석 결과의 카테고리·태그를 고쳤을 때
  function handleEdit(patch) {
    setAnalysis((a) => (a ? { ...a, ...patch } : a))
  }

  const startHandoff = useEffectEvent(() => handleAnalyze())
  const handoffDone = useRef(false)
  useEffect(() => {
    if (!handoffUrl || handoffDone.current) return
    handoffDone.current = true
    // 새로고침했을 때 다시 분석하지 않게 넘겨받은 값을 지운다
    navigate(".", { replace: true, state: null })
    startHandoff()
  }, [handoffUrl, navigate])

  function handleAbort() {
    abortRef.current?.abort()
  }

  function handleSample() {
    setMode("link")
    setUrl(SAMPLE_URL)
    handleAnalyze(SAMPLE_URL)
  }

  async function handleSave() {
    setNotice(null)
    setSaving(true)
    try {
      await saveContent(analysis)
      await reload()
      setSaved(analysis)
      setAnalysis(null)
      setUrl("")
      setMemo("")
      clearFile()
    } catch (e) {
      showError(e)
    } finally {
      setSaving(false)
    }
  }

  // 저장하지 않고 닫는다. 취소했다는 사실만 결과보고서용으로 서버에 기록한다
  function handleCancel() {
    if (analysis) logDiscard(analysis)
    setAnalysis(null)
    setNotice(null)
  }

  function handleReset() {
    setSaved(null)
    setNotice(null)
  }

  // 실패 패널이 열려 있어도 주소를 고쳐 다시 분석할 수 있게 둔다. 패널이 일하는 동안만 잠근다
  const locked = analyzing || saving || !!analysis || failureBusy
  const preview = mode === "link" && phase === "idle" ? previewText(url.trim()) : null
  const hasInput = mode === "link" ? !!url.trim() : !!file

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>자료 추가</h1>
          <p className={styles.lead}>
            주소나 PDF 하나를 넣으면 AI가 읽고 요약한 뒤, 어느 카테고리에 어떤 태그로 묶을지 제안합니다.
            저장을 누르기 전까지는 아무것도 바뀌지 않습니다.
          </p>

          <div className={styles.seg} role="group" aria-label="넣을 자료 종류">
            <button type="button" aria-pressed={mode === "link"} onClick={() => setMode("link")} disabled={locked}>
              링크
            </button>
            <button type="button" aria-pressed={mode === "pdf"} onClick={() => setMode("pdf")} disabled={locked}>
              PDF
            </button>
          </div>

          {mode === "link" ? (
            <form
              className={styles.row}
              onSubmit={(e) => {
                e.preventDefault()
                if (!locked && url.trim()) handleAnalyze()
              }}
            >
              <label className="sr-only" htmlFor="add-url">
                웹페이지 주소
              </label>
              <input
                id="add-url"
                className={styles.field}
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={locked}
                placeholder="https://"
              />
              {phase === "result" ? (
                // 분석이 끝나면 버튼이 아니라 상태 표시로 바뀐다
                <span className={styles.done} role="status">
                  분석 완료
                </span>
              ) : (
                <Button type="submit" variant="primary" disabled={locked || !url.trim()}>
                  {analyzing ? "분석 중…" : "분석 시작"}
                </Button>
              )}
            </form>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => pickFile(e.target.files?.[0])}
                hidden
              />
              {file ? (
                <div className={styles.fileRow}>
                  <span className={styles.fileName}>{file.name}</span>
                  <button type="button" className={styles.fileRemove} onClick={clearFile} disabled={locked}>
                    제거
                  </button>
                  {phase === "result" ? (
                    <span className={styles.done} role="status">
                      분석 완료
                    </span>
                  ) : (
                    <Button variant="primary" onClick={() => handleAnalyze()} disabled={locked}>
                      {analyzing ? "분석 중…" : "분석 시작"}
                    </Button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className={`${styles.drop} ${dragOver ? styles.over : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    pickFile(e.dataTransfer.files?.[0])
                  }}
                  disabled={locked}
                >
                  <b>PDF를 끌어다 놓거나 눌러서 고르세요</b>
                  <span>파일 하나, 글자가 있는 PDF만 읽을 수 있습니다</span>
                </button>
              )}
            </>
          )}

          {preview && (
            <p className={styles.preview} role="status">
              <i aria-hidden="true" />
              {preview}
            </p>
          )}

          {/* 메모는 URL이나 PDF를 넣은 뒤에만 보인다 */}
          {/* URL을 지웠다가 다시 쓰는 경우를 위해, 숨겨져도 적어 둔 내용은 지우지 않는다 */}
          {/* 분석이 시작되면 잠근다 (분석 뒤에 고쳐도 저장에는 분석할 때의 메모가 들어가기 때문) */}
          {hasInput && (
            <div className={styles.memo}>
              <label className="sr-only" htmlFor="add-memo">
                메모
              </label>
              <textarea
                id="add-memo"
                className={styles.textarea}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                disabled={locked}
                placeholder="메모 (선택). 왜 저장하는지 적어 두면 분류를 다시 검토할 때 참고합니다"
                rows={3}
              />
            </div>
          )}

          {phase === "idle" && (
            <div className={styles.row}>
              <Button variant="secondary" size="sm" onClick={handleSample}>
                예시 링크로 해 보기
              </Button>
            </div>
          )}

          {analyzing && (
            <div className={styles.busy} role="status">
              <div className={styles.spool}>
                <i />
              </div>
              <div className={styles.busyRow}>
                {/* 서버가 지금 어느 단계인지 알려 주지 않으므로, 1초 뒤부터는 두 단계를 함께 말한다 */}
                {/* 초는 매초 바뀌므로 화면 낭독기가 계속 읽지 않게 숨긴다 */}
                <span>
                  {secs < 1 ? "본문을 가져오는 중입니다." : "본문을 읽고 AI가 요약과 분류를 하는 중입니다."}{" "}
                  <span aria-hidden="true">{secs}초</span>
                  {secs >= SLOW_AFTER && (
                    <span className={styles.busyHint}> 페이지 길이에 따라 더 걸릴 수 있습니다.</span>
                  )}
                </span>
                <Button variant="secondary" size="sm" onClick={handleAbort}>
                  취소
                </Button>
              </div>
            </div>
          )}

          {notice && (
            <div className={styles.notice}>
              <Notice type={notice.type}>{notice.text}</Notice>
            </div>
          )}

          {failure && (
            <FailurePanel
              key={`${failure.code}:${failure.url ?? failure.filename}`}
              failure={failure}
              memo={memo}
              known={known}
              onAnalyzed={handlePasted}
              onSaved={handleManualSaved}
              onRetry={() => handleAnalyze(failure.source === "url" ? failure.url : undefined)}
              onClose={() => setFailure(null)}
              onUsage={refreshMe}
              onBusy={setFailureBusy}
            />
          )}

          {analysis && (
            <AnalysisResult
              analysis={analysis}
              saving={saving}
              onSave={handleSave}
              onCancel={handleCancel}
              onEdit={handleEdit}
              known={known}
              chipsRef={chipsRef}
            />
          )}

          {saved && (
            <section className={styles.savedBox} role="status">
              <b>저장했습니다</b>
              <span>
                {saved.tags.length > 0
                  ? `${saved.category} 카테고리에 묶였고, 태그 ${saved.tags.length}개로 그래프에 이어졌습니다.`
                  : `${saved.category} 카테고리에 저장했습니다. 태그가 없어 그래프에는 보이지 않고, 전체 자료에서 찾을 수 있습니다.`}
              </span>
              <div className={styles.row}>
                <Button variant="primary" onClick={() => navigate("/graph", { state: { category: saved.category } })}>
                  그래프에서 보기
                </Button>
                <Button variant="secondary" onClick={handleReset}>
                  하나 더 넣기
                </Button>
              </div>
            </section>
          )}
        </div>

        <AddStage phase={phase} contents={contents} analysis={analysis ?? saved} chipsRef={chipsRef} />
      </div>

      <div className={styles.low}>
        <section aria-labelledby="recent-title">
          <div className={styles.recentHead}>
            <h2 id="recent-title" className={styles.h2}>
              최근에 넣은 자료
            </h2>
            {contents.length > 0 && (
              <Link to="/library" className={styles.allLink}>
                전체 {contents.length}건 보기
              </Link>
            )}
          </div>
          {loading ? (
            <p className={styles.muted}>불러오는 중…</p>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : recent.length === 0 ? (
            <p className={styles.muted}>아직 저장한 자료가 없습니다. 위에서 첫 자료를 추가해 보세요.</p>
          ) : (
            <ul className={styles.list}>
              {recent.map((c, i) => (
                <li key={c.id}>
                  <Link to="/library" className={`${styles.li} ${saved && i === 0 ? styles.new : ""}`}>
                    <span className={styles.d}>{shortDay(dayOf(c.createdAt))}</span>
                    <span className={styles.dot} style={{ background: categoryColor(c.category) }} />
                    <b>{c.title || hostOf(c.url)}</b>
                    <span className={styles.src}>{hostOf(c.url)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <details className={styles.ok}>
          <summary>
            <h2 className={styles.h2}>지원하는 자료</h2>
            <span className={styles.tog} aria-hidden="true" />
          </summary>
          <div>
            <h3>잘 됩니다</h3>
            <ul>
              <li>글이 있는 웹페이지와 블로그</li>
              <li>논문 소개 페이지 (arxiv 등)</li>
              <li>기술 문서와 튜토리얼</li>
              <li>글자를 선택할 수 있는 PDF</li>
            </ul>
          </div>
          <div>
            <h3>어렵습니다</h3>
            <ul>
              <li>로그인해야 보이는 페이지</li>
              <li>스캔해서 만든 이미지 PDF</li>
              <li>본문이 거의 없는 영상, 이미지 위주 페이지</li>
            </ul>
          </div>
        </details>
      </div>
    </div>
  )
}

export default AddPage
