import { useState, useEffect, useCallback } from "react"
import { fetchContents } from "../api/content"

export function useContents() {
  const [contents, setContents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    try {
      setContents(await fetchContents())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { contents, loading, error, reload }
}