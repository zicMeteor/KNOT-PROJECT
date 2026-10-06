import { useState, useEffect } from "react"
import { fetchContents, analyzeUrl, saveContent } from "./api/content"

function App() {
  const [contents, setContents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [url, setUrl] = useState("")
  const [memo, setMemo] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [formError, setFormError] = useState(null)

  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState(null)

  async function load() {
    try {
      const data = await fetchContents()
      setContents(data)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAnalyze() {
    setFormError(null)
    setSavedMessage(null)
    setAnalysis(null)
    setAnalyzing(true)
    try {
      const result = await analyzeUrl(url.trim(), memo)
      setAnalysis({ ...result, url: url.trim(), memo: memo })
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
      await load()
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
        <button onClick={handleAnalyze} disabled={analyzing || saving || !url}>
          {analyzing ? "분석 중…" : "분석 시작"}
        </button>
      </div>

      {formError && <p>{formError}</p>}
      {savedMessage && <p>{savedMessage}</p>}

      {analysis && (
        <div>
          <h2>{analysis.title ?? analysis.url}</h2>
          <p>카테고리: {analysis.category}</p>
          <p>
            태그:{" "}
            {analysis.tags
              .map((t) => (t.is_new ? "★ " + t.name : t.name))
              .join(", ")}
          </p>
          <p>{analysis.summary}</p>
          <button onClick={handleSave} disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </button>
          <button onClick={handleCancel} disabled={saving}>
            취소
          </button>
        </div>
      )}

      {loading && <p>불러오는 중…</p>}
      {error && <p>오류: {error}</p>}
      {!loading && !error && (
        <ul>
          {contents.map((c) => (
            <li key={c.id}>
              [{c.category}] {c.title ?? c.url}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App