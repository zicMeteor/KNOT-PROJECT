function ContentList({ contents, loading, error }) {
  if (loading) return <p>불러오는 중…</p>
  if (error) return <p>오류: {error}</p>
  return (
    <ul>
      {contents.map((c) => (
        <li key={c.id}>
          [{c.category}] {c.title ?? c.url}
        </li>
      ))}
    </ul>
  )
}

export default ContentList