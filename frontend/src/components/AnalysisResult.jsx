import Button from "./ui/Button"
import styles from "./AnalysisResult.module.css"

function AnalysisResult({ analysis, saving, onSave, onCancel }) {
  const hasNewTag = analysis.tags.some((t) => t.is_new)

  return (
    <section className={styles.card}>
      <h2 className={styles.title}>{analysis.title ?? analysis.url}</h2>
      <p className={styles.category}>카테고리: {analysis.category}</p>

      <ul className={styles.tags}>
        {analysis.tags.map((t) => (
          <li
            key={t.name}
            className={
              t.is_new ? `${styles.tag} ${styles.newTag}` : styles.tag
            }
          >
            {t.is_new && "★ "}
            {t.name}
          </li>
        ))}
      </ul>
      {hasNewTag && <p className={styles.legend}>★ 새로 만들어진 태그</p>}

      <p className={styles.summary}>{analysis.summary}</p>

      <div className={styles.actions}>
        <Button onClick={onCancel} disabled={saving}>
          취소
        </Button>
        <Button variant="primary" onClick={onSave} disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </Button>
      </div>
    </section>
  )
}

export default AnalysisResult