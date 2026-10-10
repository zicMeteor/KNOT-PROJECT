// 홈 두 번째 구역: 같은 자료에 닿는 세 가지 길 (그래프, 목록, AI)
// 아무것도 건드리지 않으면 저장한 자료로 시연을 돌리고, 입력칸을 누르면 시연을 멈추고 직접 쓸 수 있다
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useLibraryFilter } from "../../hooks/useLibraryFilter"
import { categoryColor } from "../../constants/categories"
import { create, reducedMotion, topTags as pickTags } from "../../lib/threadGraph"
import styles from "./HomeWays.module.css"

// 시연을 한 바퀴 돌리는 간격 (ms)과 글자 하나를 치는 간격 (ms)
const CYCLE_MS = 5200
const TICK_MS = 70
const TICKS_PER_CYCLE = Math.round(CYCLE_MS / TICK_MS)
// 시연에 쓰는 태그 수 (자료가 많은 순)
const DEMO_TAGS = 5
// 그래프 칸에 그릴 태그 수 (자료가 많은 순). 칸이 작고 한 태그를 확대해 보여 주므로 많을 필요가 없다
// 시연 태그(DEMO_TAGS개)는 자료가 가장 많은 태그라 항상 이 안에 든다
// 아래 "이웃 태그 n개"는 그리지 않은 태그까지 센 실제 수다 (그래프에 보이는 이웃은 그보다 적을 수 있다)
const WAYS_MAX_TAGS = 12
// 목록 칸에 보여 줄 결과 수
const LIST_ROWS = 5

function Row({ item }) {
  return (
    <li className={styles.row}>
      <i style={{ background: categoryColor(item.category) }} aria-hidden="true" />
      <span>{item.title}</span>
    </li>
  )
}

function HomeWays({ contents, graph }) {
  const navigate = useNavigate()
  const reduced = useMemo(() => reducedMotion(), [])

  // 자료가 많은 태그부터
  const topTags = useMemo(
    () => [...graph.nodes].sort((a, b) => b.count - a.count).slice(0, DEMO_TAGS),
    [graph]
  )

  // 그래프 칸에 그릴 것: 자료가 많은 태그 WAYS_MAX_TAGS개
  const drawGraph = useMemo(() => pickTags(graph, WAYS_MAX_TAGS), [graph])

  // 시연 시계: 한 칸이 TICK_MS. 몇 번째 바퀴인지와 지금까지 친 글자 수를 여기서 함께 얻는다
  const [tick, setTick] = useState(0)
  const [listQuery, setListQuery] = useState("")
  const [listTouched, setListTouched] = useState(false)
  const [question, setQuestion] = useState("")
  const [askTouched, setAskTouched] = useState(false)

  useEffect(() => {
    if (reduced || topTags.length === 0) return
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS)
    return () => clearInterval(id)
  }, [reduced, topTags.length])

  const step = Math.floor(tick / TICKS_PER_CYCLE)
  const typed = reduced ? Infinity : tick % TICKS_PER_CYCLE
  const cut = (s) => s.slice(0, typed)

  const demo = topTags.length > 0 ? topTags[step % topTags.length] : null
  const demoWord = demo ? demo.label : ""
  const demoQuestion = demo ? `${demo.label} 관련해서 저장한 자료 찾아줘` : "지난주에 저장한 자료 찾아줘"

  const shownWord = listTouched ? listQuery : cut(demoWord)
  const listItems = useLibraryFilter(contents, shownWord, null)

  // 그래프 칸
  const canvasRef = useRef(null)
  const graphRef = useRef(null)
  useEffect(() => {
    if (!canvasRef.current || drawGraph.nodes.length === 0) return
    if (!graphRef.current) {
      graphRef.current = create(canvasRef.current, {
        data: drawGraph,
        scale: 0.36,
        cy: 0.46,
        labels: "big",
        labelMin: 1,
        labelMax: 8,
        dust: 30,
        seed: 8,
        speed: 0.04,
        fontSize: 11,
      })
    } else {
      graphRef.current.setData(drawGraph, true)
    }
  }, [drawGraph])
  useEffect(
    () => () => {
      graphRef.current?.destroy()
      graphRef.current = null
    },
    []
  )
  useEffect(() => {
    const g = graphRef.current
    if (!g || !demo) return
    g.select(demo.id)
    g.view({ focus: demo.id, zoom: 1.5 })
  }, [demo, drawGraph])

  const neighbors = demo
    ? graph.links.filter((l) => l.source === demo.id || l.target === demo.id).length
    : 0

  function submitList(e) {
    e.preventDefault()
    const q = (listTouched ? listQuery : demoWord).trim()
    navigate("/library", { state: q ? { q } : null })
  }

  function submitAsk(e) {
    e.preventDefault()
    const q = question.trim()
    if (!q) return
    navigate("/graph", { state: { q } })
  }

  return (
    <section className={styles.sec} aria-labelledby="ways-title">
      <h2 className={styles.h2} id="ways-title">
        찾는 길은 세 가지입니다
      </h2>
      <p className={styles.lead}>
        그래프에 익숙하지 않아도 됩니다. 목록에서 단어로 바로 거르거나, 기억나는 대로 AI에게 물어도
        같은 자료에 닿습니다.
      </p>

      <div className={styles.grid}>
        <article className={styles.tile}>
          <div className={styles.top}>
            <h3>그래프로</h3>
            <span>태그를 고르면 이웃만 남습니다</span>
          </div>
          <div className={styles.body}>
            <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
            <p className={styles.cap} aria-live="polite">
              {demo ? (
                <>
                  <b>#{demo.label}</b> 자료 {demo.count}건, 이웃 태그 {neighbors}개
                </>
              ) : (
                "자료를 저장하면 태그가 이어집니다"
              )}
            </p>
          </div>
          <Link to="/graph" className={styles.more}>
            지식 그래프 열기
          </Link>
        </article>

        <article className={styles.tile}>
          <div className={styles.top}>
            <h3>목록으로</h3>
            <span>AI 없이 즉시</span>
          </div>
          <div className={styles.body}>
            <form onSubmit={submitList}>
              <label className={styles.sr} htmlFor="ways-list">
                전체 자료에서 찾을 단어
              </label>
              <input
                id="ways-list"
                className={styles.input}
                type="search"
                value={shownWord}
                onFocus={() => {
                  if (!listTouched) {
                    setListTouched(true)
                    setListQuery("")
                  }
                }}
                onChange={(e) => setListQuery(e.target.value)}
                placeholder="단어를 입력하세요"
                autoComplete="off"
              />
            </form>
            <p className={styles.n}>
              {!listTouched && shownWord && "예시, "}
              {shownWord ? `'${shownWord}' ${listItems.length}건` : `전체 ${contents.length}건`}
            </p>
            <ul className={styles.list}>
              {listItems.slice(0, LIST_ROWS).map((it) => (
                <Row key={it.id} item={it} />
              ))}
            </ul>
          </div>
          <Link to="/library" state={shownWord ? { q: shownWord } : null} className={styles.more}>
            전체 자료에서 보기
          </Link>
        </article>

        <article className={styles.tile}>
          <div className={styles.top}>
            <h3>AI에게</h3>
            <span>질문에서 태그와 키워드를 뽑음</span>
          </div>
          <div className={styles.body}>
            <form onSubmit={submitAsk} className={styles.askForm}>
              <label className={styles.sr} htmlFor="ways-ask">
                AI에게 물어볼 질문
              </label>
              <textarea
                id="ways-ask"
                className={styles.ask}
                rows={3}
                maxLength={200}
                value={askTouched ? question : cut(demoQuestion)}
                onFocus={() => {
                  if (!askTouched) {
                    setAskTouched(true)
                    setQuestion("")
                  }
                }}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) submitAsk(e)
                }}
                placeholder="기억나는 대로 물어보세요"
              />
              <button type="submit" className={styles.askBtn} disabled={!askTouched || !question.trim()}>
                지식 그래프에서 찾기
              </button>
            </form>
            <p className={styles.n}>
              답은 지식 그래프 화면에서 보여 줍니다. 찾은 자료가 그래프에서 빛납니다.
            </p>
          </div>
        </article>
      </div>
    </section>
  )
}

export default HomeWays
