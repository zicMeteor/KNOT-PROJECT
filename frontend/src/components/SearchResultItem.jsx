import styles from "./SearchResultItem.module.css"

const MATCH_LABEL = {
  tag: "태그 일치",
  keyword: "키워드 일치",
  expanded: "연관 태그",
  category: "카테고리",
}

function SearchResultItem({ item }) {
  return (
    <li className={styles.item}>
      <div className={styles.head}>
        <h3 className={styles.title}>{item.title}</h3>
        <span className={styles.match}>
          {MATCH_LABEL[item.matchType] ?? item.matchType}
        </span>
      </div>
      <p className={styles.meta}>{item.category}</p>
      <p className={styles.summary}>{item.summary}</p>
      {item.tags.length > 0 && (
        <ul className={styles.tags}>
          {item.tags.map((t) => (
            <li key={t} className={styles.tag}>
              {t}
            </li>
          ))}
        </ul>
      )}
      {item.url && (
        <a
          className={styles.link}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          원문 열기
        </a>
      )}
    </li>
  )
}

export default SearchResultItem