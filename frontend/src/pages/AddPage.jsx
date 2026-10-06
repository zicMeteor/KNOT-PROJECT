import { useState } from "react"
import { analyzeUrl, saveContent } from "../api/content"
import { useContents } from "../hooks/useContents"
import AnalysisResult from "../components/AnalysisResult"
import ContentList from "../components/ContentList"

function AddPage() {
  const { contents, loading, error, reload } = useContents()

  const [url, setUrl] = useState("")
  const [memo, setMemo] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState(null)

  async function handleAnalyze() {
    const u = url.trim()
    setFormError(null)
    setSavedMessage(null)
    setAnalysis(null)

    if (!/^https?:\/\//i.test(u)) {
      setFormError("http:// 또는 https://로 시작하는 주소를 입력하세요")
      return
    }

    setAnalyzing(true)
    try {
      const result = await analyzeUrl(u, memo)
      setAnalysis({ ...result, url: u, memo: memo })
    } catch (e) {
      setFormError(e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSave() {
    setFormError(null)
    setSaving(true)
    try {
      await saveContent(analysis)
      await reload()
      setAnalysis(null)
      setUrl("")
      setMemo("")
      setSavedMessage("저장했습니다")
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setAnalysis(null)
    setSavedMessage(null)
  }

  return (
    <div>
      <h1>자료 {contents.length}건</h1>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          maxWidth: "500px",
          margin: "0 auto",
        }}
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="웹페이지 주소를 붙여넣으세요"
          style={{ width: "100%" }}
        />
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          rows={3}
          style={{ width: "100%" }}
        />
        <p>메모는 나중에 재분류할 때 참고합니다</p>
        <button onClick={handleAnalyze} disabled={analyzing || saving || !url.trim()}>
          {analyzing ? "분석 중…" : "분석 시작"}
        </button>
      </div>

      {formError && <p>{formError}</p>}
      {savedMessage && <p>{savedMessage}</p>}

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