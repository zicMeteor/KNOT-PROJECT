import { useRef, useState } from "react"
import { analyzePdf, analyzeUrl, saveContent } from "../api/content"
import { useContents } from "../hooks/useContents"
import AnalysisResult from "../components/AnalysisResult"
import ContentList from "../components/ContentList"
import Button from "../components/ui/Button"
import Notice from "../components/ui/Notice"
import styles from "./AddPage.module.css"

function AddPage() {
  const { contents, loading, error, reload } = useContents()

  const [url, setUrl] = useState("")
  const [file, setFile] = useState(null)
  const [memo, setMemo] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null) // { type: "success" | "warn" | "error", text }
  const abortRef = useRef(null)
  const fileInputRef = useRef(null)

  function showError(e) {
    setNotice({
      type: e.code === "duplicate" ? "warn" : "error",
      text: e.message,
    })
  }

  function clearFile() {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleFileChange(e) {
    const picked = e.target.files?.[0]
    if (!picked) return
    if (!picked.name.toLowerCase().endsWith(".pdf")) {
      setNotice({ type: "error", text: "PDF 파일만 선택할 수 있습니다" })
      e.target.value = ""
      return
    }
    setNotice(null)
    setAnalysis(null)
    setFile(picked)
  }

  async function handleAnalyze() {
    setNotice(null)
    setAnalysis(null)

    let u = ""
    if (!file) {
      u = url.trim()
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
    setAnalyzing(true)
    try {
      if (file) {
        const result = await analyzePdf(file, controller.signal)
        setAnalysis({ ...result, url: null, source: "pdf", memo: memo })
      } else {
        const result = await analyzeUrl(u, memo, controller.signal)
        setAnalysis({ ...result, url: u, source: "url", memo: memo })
      }
    } catch (e) {
      if (e.name === "AbortError") return
      showError(e)
    } finally {
      abortRef.current = null
      setAnalyzing(false)
    }
  }

  function handleAbort() {
    abortRef.current?.abort()
  }

  async function handleSave() {
    setNotice(null)
    setSaving(true)
    try {
      await saveContent(analysis)
      await reload()
      setAnalysis(null)
      setUrl("")
      setMemo("")
      clearFile()
      setNotice({ type: "success", text: "저장했습니다" })
    } catch (e) {
      showError(e)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setAnalysis(null)
    setNotice(null)
  }

  const plusTip = file
    ? "PDF가 이미 추가되어 있습니다. ×로 제거하세요"
    : url.trim()
    ? "URL 입력을 지우면 PDF를 추가할 수 있습니다"
    : analyzing || saving
    ? "처리 중에는 변경할 수 없습니다"
    : "PDF 추가 (파일 1개, 텍스트가 있는 PDF만)"

  return (
    <div className={styles.page}>
      <h1>자료 {contents.length}건</h1>

      <div className={styles.form}>
        <div className={styles.urlBox}>
          <span className={styles.plusWrap}>
            <button
              type="button"
              className={styles.plus}
              onClick={() => fileInputRef.current?.click()}
              disabled={!!file || !!url.trim() || analyzing || saving}
              aria-label="PDF 추가"
              aria-describedby="plus-tip"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path
                  d="M8 2v12M2 8h12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>
            <span id="plus-tip" role="tooltip" className={styles.tooltip}>
              {plusTip}
            </span>
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
            hidden
          />

          {file ? (
            <div className={styles.chip}>
              <span className={styles.chipName}>{file.name}</span>
              <button
                type="button"
                className={styles.chipRemove}
                onClick={clearFile}
                disabled={analyzing || saving}
                aria-label="PDF 제거"
              >
                ×
              </button>
            </div>
          ) : (
            <>
              <input
                className={styles.urlInput}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    if (url.trim() && !analyzing && !saving) handleAnalyze()
                  }
                }}
                placeholder="웹페이지 주소를 붙여넣으세요"
              />
              {url.trim() && !analyzing && !saving && (
                <button
                  type="button"
                  className={styles.enterHint}
                  onClick={handleAnalyze}
                  aria-label="분석 시작 (Enter)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    aria-hidden="true"
                  >
                    <polyline
                      points="9 10 4 15 9 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M20 4v7a4 4 0 0 1-4 4H4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>

        <textarea
          className={styles.input}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          rows={3}
        />
        <p className={styles.hint}>메모는 나중에 재분류할 때 참고합니다</p>

        <div className={styles.actions}>
          <Button
            variant="primary"
            onClick={handleAnalyze}
            disabled={analyzing || saving || (!file && !url.trim())}
          >
            {analyzing ? "분석 중…" : "분석 시작"}
          </Button>
          {analyzing && <Button onClick={handleAbort}>취소</Button>}
        </div>
      </div>

      {notice && <Notice type={notice.type}>{notice.text}</Notice>}

      {analysis && (
        <AnalysisResult
          analysis={analysis}
          saving={saving}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      <ContentList contents={contents} loading={loading} error={error} />
    </div>
  )
}

export default AddPage