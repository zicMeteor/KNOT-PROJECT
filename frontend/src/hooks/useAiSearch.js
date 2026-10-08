import { useEffect, useRef, useState } from "react"
import { aiSearch } from "../api/aiSearch"

// AI 검색 상태. status: idle | loading | done | error
export function useAiSearch() {
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
      const data = await aiSearch(text, ctrl.signal)
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

  // 진행 중인 검색을 멈추고 결과까지 지운다 (그래프 강조도 함께 사라진다)
  function reset() {
    abortRef.current?.abort()
    setResult(null)
    setError(null)
    setStatus("idle")
  }

  return { status, result, error, run, cancel, reset }
}