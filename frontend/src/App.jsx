import { useState, useEffect } from "react"
import { fetchContents } from "./api/content"

function App() {
  const [contents, setContents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchContents()
        setContents(data)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <p>불러오는 중…</p>
  if (error) return <p>오류: {error}</p>

  return (
    <div>
      <h1>자료 {contents.length}건</h1>
      <ul>
        {contents.map((c) => (
          <li key={c.id}>
            [{c.category}] {c.title ?? c.url}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App
