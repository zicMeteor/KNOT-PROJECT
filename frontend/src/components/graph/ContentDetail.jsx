import { pdfFileUrl } from "../../api/content"
import styles from "./ContentDetail.module.css"

function formatDate(s) {
  if (!s) return ""
  const d = new Date(s)
  return isNaN(d) ? s : d.toLocaleDateString("ko-KR")
}

function tagName(t) {
  return typeof t === "string" ? t : t.name
}

function domainOf(url) {
  if (!url) return ""
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function ContentDetail({ content }) {
  const { id, title, url, category, createdAt, tags = [], summary, memo, hasFile } = content

  return (
    <article className={styles.detail}>
      <h3 className={styles.title}>{title || domainOf(url) || "제목 없음"}</h3>

      <p className={styles.meta}>
        {category && <span className={styles.category}>{category}</span>}
        {createdAt && <span>{formatDate(createdAt)}</span>}
      </p>

      {tags.length > 0 && (
        <ul className={styles.tags}>
          {tags.map((t) => (
            <li key={tagName(t)} className={styles.tag}>
              {tagName(t)}
            </li>
          ))}
        </ul>
      )}

      {summary && <p className={styles.summary}>{summary}</p>}

      {memo && <p className={styles.memo}>메모: {memo}</p>}

      {url && (
        <a
          className={styles.source}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>원문 열기</span>
          <span className={styles.domain}>{domainOf(url)}</span>
        </a>
      )}

      {!url && hasFile && (
        <a className={styles.source} href={pdfFileUrl(id)} target="_blank" rel="noopener noreferrer">
          <span>원본 PDF 열기</span>
        </a>
      )}
    </article>
  )
}

export default ContentDetail