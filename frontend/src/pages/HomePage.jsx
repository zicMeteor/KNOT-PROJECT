// src/pages/HomePage.jsx
// 홈: 첫 화면(링크 입력과 자료 상자) → 숫자로 보는 지식 → 링크 하나가 지식이 되기까지 → 찾고 다시 묶는 길 → 지식이 자라는 모습
// 넓은 화면에서는 구역마다 스크롤에 맞춰 장면이 진행된다 (스크롤리텔링)
import { useMemo, useRef } from "react"
import { Link } from "react-router-dom"
import { useContents } from "../hooks/useContents"
import { byNewest } from "../hooks/useLibraryFilter"
import { tagGraph, topTags } from "../lib/threadGraph"
import { useViewProgress } from "../lib/scrollPin"
import HomeHero from "../components/home/HomeHero"
import HomeStats from "../components/home/HomeStats"
import HomeStory from "../components/home/HomeStory"
import HomeWays from "../components/home/HomeWays"
import HomeTimeline from "../components/home/HomeTimeline"
import styles from "./HomePage.module.css"
import { SAMPLE_CONTENTS } from "../constants/sampleContents"

// 첫 화면 카드 수. HomeHero의 CRATE_COUNT와 같아야 한다
const RECENT_CARDS = 12

function HomePage() {
  const { contents: mine, loading, error } = useContents()
  // 자료가 하나도 없으면 홈의 설명 구간을 예시 자료로 채운다 (실제 자료가 아님을 구간마다 표시)
  const sample = !loading && !error && mine.length === 0
  const contents = sample ? SAMPLE_CONTENTS : mine
  // 태그 그래프: 노드 = 태그, 엣지 = 두 태그를 함께 쓴 자료 수
  const graph = useMemo(
    () => tagGraph(contents.map((c) => ({ cat: c.category, tags: c.tags ?? [] }))),
    [contents]
  )

  // 첫 화면 그래프: 자료가 많은 태그 40개 + 오른쪽 카드 더미(최근 RECENT_CARDS건)의 태그
  // 태그가 40개 이하면 전체 그래프를 그대로 그린다
  const heroGraph = useMemo(() => {
    const recent = [...contents].sort(byNewest).slice(0, RECENT_CARDS)
    const keep = recent.flatMap((c) => (c.tags ?? []).map((t) => String(t).toLowerCase()))
    return topTags(graph, 40, keep)
  }, [contents, graph])

  // 맨 아래 KNOT 글자가 모이는 정도
  const endRef = useRef(null)
  const endP = useViewProgress(endRef, { startAt: 1, span: 0.9 })

  return (
    <div className={styles.page}>
      <HomeHero contents={contents} graph={heroGraph} loading={loading} error={error} sample={sample} />
      {sample && (
        <section className={styles.empty} aria-labelledby="empty-title">
          <h2 id="empty-title">첫 자료를 추가해 보세요</h2>
          <p className={styles.emptyCopy}>
            아직 저장한 자료가 없어서, 아래는 <b>예시 자료 {SAMPLE_CONTENTS.length}건</b>으로 KNOT이 어떻게
            쓰이는지 보여 줍니다. 첫 자료를 저장하면 첫 화면과 숫자는 바로 내 자료로 바뀌고, 찾는 길은
            자료가 조금 더 모이면 바뀝니다(분류 다시 검토 예시는 그대로).
          </p>
          <Link to="/add" className={styles.emptyAction}>
            자료 추가
          </Link>
        </section>
      )}
      {contents.length > 0 && (
        <>
          <HomeStats contents={contents} graph={graph} sample={sample} />
          <HomeStory contents={contents} sample={sample} />
          <HomeWays mine={mine} />
          <HomeTimeline contents={contents} sample={sample} />
        </>
      )}
      <footer ref={endRef} className={styles.end} style={{ "--k": endP }}>
        <p className={styles.big} aria-hidden="true">
          KNOT
        </p>
        <div className={styles.endRow}>
          <p className={styles.foot}>
            KNOT, 읽은 것을 잇는 개인 지식 그래프 ·{" "}
            <a href="https://github.com/zicMeteor/KNOT-PROJECT" target="_blank" rel="noreferrer">
              소스 코드 (AGPL-3.0)
            </a>
          </p>
          {/* 맨 아래까지 내려온 사람이 바로 다음 일을 고를 수 있게 */}
          <nav className={styles.endLinks} aria-label="홈 끝 바로가기">
            <Link to="/add" className={styles.emptyAction}>
              자료 추가
            </Link>
            <Link to="/graph" className={styles.endGhost}>
              지식 그래프 열기
            </Link>
            <Link to="/library" className={styles.endGhost}>
              전체 자료
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

export default HomePage
