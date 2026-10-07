import { useEffect, useState } from "react"
import { fetchGraph, fetchCategoryGraph } from "../api/graph"

// category가 null이면 전체(카테고리) 그래프, 아니면 그 카테고리의 태그 그래프
// reloadKey가 바뀌면 다시 불러온다 (재분류 후)
export function useGraphData(category, reloadKey) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    const job = category ? fetchCategoryGraph(category) : fetchGraph()
    job
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [category, reloadKey])

  return { data, error }
}