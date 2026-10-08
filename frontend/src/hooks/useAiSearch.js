import { useEffect, useRef, useState } from "react"
import { searchContents } from "../api/search"

// status: idle | loading | done | error
export function useSearch() {
  const [status, setStatus] = useState("idle")
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  async function run(query) {
    const text = query.trim()
    if (!text) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setError(null)
    setStatus("loading")
    try {
      const data = await searchContents(text, ctrl.signal)
      setResult({ ...data, query: text })
      setStatus("done")
    } catch (e) {
      if (e.name === "AbortError") return
      setError(e.message)
      setStatus("error")
    }
  }

  function cancel() {
    abortRef.current?.abort()
    setStatus(result ? "done" : "idle")
  }

  return { status, result, error, run, cancel }
}