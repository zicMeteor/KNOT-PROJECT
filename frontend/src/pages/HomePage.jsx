// src/pages/HomePage.jsx
// 홈: 첫 화면(링크 입력과 자료 상자) → 찾는 길 세 가지 → 지식이 자라는 모습
import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useContents } from "../hooks/useContents"
import { byNewest } from "../hooks/useLibraryFilter"
import { tagGraph, topTags } from "../lib/threadGraph"
import HomeHero from "../components/home/HomeHero"
import HomeWays from "../components/home/HomeWays"
import HomeTimeline from "../components/home/HomeTimeline"
import styles from "./HomePage.module.css"

// 첫 화면 카드 수. HomeHero의 CRATE_COUNT와 같아야 한다
const RECENT_CARDS = 12

function HomePage() {
  const { contents, loading, error } = useContents()
  // 태그 그래프: 노드 = 태그, 엣지 = 두 태그를 함께 쓴 자료 수
  const graph = useMemo(
    () => tagGraph(contents.map((c) => ({ cat: c.category, tags: c.tags ?? [] }))),
    [contents]
  )
  // 첫 화면 그래프: 오른쪽 카드 더미(최근 RECENT_CARDS건)의 태그만 그린다
  // 화면의 점이 모두 카드 중 하나와 이어지고, 자료가 늘어도 점 수가 거의 일정하다 (보통 30~45개)
  const heroGraph = useMemo(() => {
    const recent = [...contents].sort(byNewest).slice(0, RECENT_CARDS)
    const keep = recent.flatMap((c) => (c.tags ?? []).map((t) => String(t).toLowerCase()))
    return topTags(graph, 0, keep)
  }, [contents, graph])

  return (
    <div className={styles.page}>
      <HomeHero contents={contents} graph={heroGraph} loading={loading} error={error} />
      {!loading && contents.length === 0 && !error && (
        <section className={styles.empty} aria-labelledby="empty-title">
          <p className={styles.eyebrow}>KNOT 시작하기</p>
          <h2 id="empty-title">첫 자료를 추가해 보세요</h2>
          <p className={styles.emptyCopy}>
            자료를 저장하면 AI가 요약하고, 카테고리와 태그를 지식 그래프로 연결합니다.
          </p>
          <Link to="/add" className={styles.emptyAction}>
            자료 추가
          </Link>
        </section>
      )}
      {contents.length > 0 && (
        <>
          <HomeWays contents={contents} graph={graph} />
          <HomeTimeline contents={contents} />
        </>
      )}
      <footer className={styles.end}>
        <p className={styles.big} aria-hidden="true">
          KNOT
        </p>
        <p className={styles.foot}>KNOT, 읽은 것을 잇는 개인 지식 그래프</p>
      </footer>
    </div>
  )
}

export default HomePage
