import { useEffect, useState } from "react"
import { fetchGraph, fetchCategoryGraph } from "../api/graph"

// category가 null이면 전체(카테고리) 그래프, 아니면 그 카테고리의 태그 그래프
// reloadKey가 바뀌면 다시 불러온다 (재분류 후)
// 새 데이터가 올 때까지 이전 데이터를 유지한다.
// 비우면 그래프 컴포넌트가 사라졌다가 다시 생기면서 WebGL 컨텍스트가 매번 새로 만들어진다.
export function useGraphData(category, reloadKey) {
  // 데이터와 그 데이터가 어느 카테고리 것인지를 한 번에 바꿔서 둘이 어긋나지 않게 한다
  const [loaded, setLoaded] = useState({ data: null, dataCategory: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const job = category ? fetchCategoryGraph(category) : fetchGraph()
    job
      .then((d) => {
        if (!cancelled) setLoaded({ data: d, dataCategory: category })
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [category, reloadKey])

  return { data: loaded.data, dataCategory: loaded.dataCategory, loading, error }
}