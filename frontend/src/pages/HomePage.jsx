// src/pages/HomePage.jsx
// 홈: 첫 화면(링크 입력과 자료 상자) → 숫자로 보는 지식 → 링크 하나가 지식이 되기까지 → 찾고 다시 묶는 길 → 지식이 자라는 모습
// 넓은 화면에서는 구역마다 스크롤에 맞춰 장면이 진행된다 (스크롤리텔링)
import { useMemo, useRef } from "react"
import { Link } from "react-router-dom"
import { useContents } from "../hooks/useContents"
import { byNewest } from "../hooks/useLibraryFilter"
import { dayOf } from "../lib/contentMeta"
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
// 처음 쓰는 사람에게 3단계 안내를 보여 주는 자료 수 (이만큼 모이면 안내가 사라진다)
const GUIDE_GOAL = 3

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

  // 지식이 자라는 모습은 저장한 날이 이틀 이상이어야 변화가 보여서, 그 전에는 예시 자료로 보여 준다
  const myDays = useMemo(() => new Set(mine.map((c) => dayOf(c.createdAt)).filter(Boolean)).size, [mine])
  const timelineSample = sample || (!loading && !error && myDays < 2)
  const showGuide = !loading && !error && mine.length < GUIDE_GOAL

  // 맨 아래 KNOT 글자가 모이는 정도
  const endRef = useRef(null)
  const endP = useViewProgress(endRef, { startAt: 1, span: 0.9 })

  return (
    <div className={styles.page}>
      <HomeHero contents={contents} graph={heroGraph} loading={loading} error={error} sample={sample} />
      {/* 처음 쓰는 사람에게 할 일과 그 효과를 알린다. 자료가 GUIDE_GOAL건 모이면 사라진다 */}
      {showGuide && (
        <section className={styles.empty} aria-labelledby="empty-title">
          <h2 id="empty-title">{mine.length === 0 ? "처음이라면 이렇게 해 보세요" : "조금만 더 넣어 보세요"}</h2>
          <p className={styles.emptyCopy}>
            같은 주제 자료가 2~3건 모이면 서로 이어지고, 제목을 몰라도 생각나는 말로 찾을 수 있습니다.
            {sample && (
              <>
                {" "}아래는 <b>예시 자료 {SAMPLE_CONTENTS.length}건</b>으로 보여 주는 화면이고, 자료를 저장하면
                하나씩 내 자료로 바뀝니다.
              </>
            )}
          </p>
          <div
            className={styles.progress}
            role="progressbar"
            aria-label="처음 넣을 자료"
            aria-valuemin={0}
            aria-valuemax={GUIDE_GOAL}
            aria-valuenow={mine.length}
          >
            <i style={{ width: `${(mine.length / GUIDE_GOAL) * 100}%` }} />
          </div>
          <p className={styles.progressText}>
            지금 {mine.length} / {GUIDE_GOAL}건
          </p>
          <ol className={styles.guide}>
            <li>
              <Link to="/add" className={styles.guideMain}>
                <span>1단계</span>최근에 읽은 링크·PDF {GUIDE_GOAL}개 넣기
              </Link>
            </li>
            <li>
              <Link to="/library">
                <span>2단계</span>전체 자료에서 기억나는 단어로 찾기
              </Link>
            </li>
            <li>
              <Link to="/graph">
                <span>3단계</span>지식 그래프에서 이어진 태그 눌러 보기
              </Link>
            </li>
          </ol>
        </section>
      )}
      {contents.length > 0 && (
        <>
          <HomeStats contents={contents} graph={graph} sample={sample} />
          <HomeStory contents={contents} sample={sample} />
          <HomeWays mine={mine} />
          <HomeTimeline
            contents={timelineSample ? SAMPLE_CONTENTS : contents}
            sample={timelineSample}
            myDays={mine.length > 0 ? myDays : null}
          />
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
