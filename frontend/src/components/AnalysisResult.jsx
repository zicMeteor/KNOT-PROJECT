function AnalysisResult({ analysis, saving, onSave, onCancel }) {
  return (
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
      <button onClick={onSave} disabled={saving}>
        {saving ? "저장 중…" : "저장"}
      </button>
      <button onClick={onCancel} disabled={saving}>
        취소
      </button>
    </div>
  )
}

export default AnalysisResult