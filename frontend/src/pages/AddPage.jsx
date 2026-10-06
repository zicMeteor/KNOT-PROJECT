import { useRef, useState } from "react"
import { analyzeUrl, saveContent } from "../api/content"
import { useContents } from "../hooks/useContents"
import AnalysisResult from "../components/AnalysisResult"
import ContentList from "../components/ContentList"
import Button from "../components/ui/Button"
import Notice from "../components/ui/Notice"
import styles from "./AddPage.module.css"

function AddPage() {
  const { contents, loading, error, reload } = useContents()

  const [url, setUrl] = useState("")
  const [memo, setMemo] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null) // { type: "success" | "warn" | "error", text }
  const abortRef = useRef(null)

  function showError(e) {
    setNotice({
      type: e.code === "duplicate" ? "warn" : "error",
      text: e.message,
    })
  }

  async function handleAnalyze() {
    const u = url.trim()
    setNotice(null)
    setAnalysis(null)

    if (!/^https?:\/\//i.test(u)) {
      setNotice({
        type: "error",
        text: "http:// 또는 https://로 시작하는 주소를 입력하세요",
      })
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setAnalyzing(true)
    try {
      const result = await analyzeUrl(u, memo, controller.signal)
      setAnalysis({ ...result, url: u, memo: memo })
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

  return (
    <div className={styles.page}>
      <h1>자료 {contents.length}건</h1>

      <div className={styles.form}>
        <input
          className={styles.input}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="웹페이지 주소를 붙여넣으세요"
        />
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
            disabled={analyzing || saving || !url.trim()}
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