// 홈 구역: 같은 자료에 닿는 세 가지 길(그래프, 목록, AI)과 목적에 맞게 다시 묶는 길
// 그림(시연)과 설명이 줄마다 좌우 자리를 바꾼다. 줄이 화면을 지나가는 만큼 그 줄의 시연이 진행된다
// 네 줄 모두 가장 많이 쓴 태그 하나를 따라간다 (같은 자료에 여러 길로 닿는다는 이야기)
// 입력칸을 누르면 시연을 멈추고 직접 쓸 수 있다. 움직임 줄이기 설정이면 처음부터 마지막 모습
// 내 자료가 시연할 만큼 모이지 않았으면 예시 자료로 시연한다 (기준은 lib/waysDemo.js). 직접 입력한 검색은 언제나 내 자료에서 찾는다
// 글자 표시: "예시"는 내 자료가 아닐 때만, "시연"은 내 자료로 움직임을 보여 줄 때
// 스크롤 연출: 제목이 떠오르고, 줄 사이를 잇는 실이 내려온 만큼 그려지고, 그림과 설명이 양옆에서 들어온다
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useLibraryFilter, byNewest } from "../../hooks/useLibraryFilter"
import { categoryColor } from "../../constants/categories"
import { create, topTags as pickTags } from "../../lib/threadGraph"
import { RICH, SAMPLE_DEMO, SAMPLE_GRAPH, SAMPLE_REGROUP, waysData } from "../../lib/waysDemo"
import { SAMPLE_CONTENTS } from "../../constants/sampleContents"
import { useViewProgress } from "../../lib/scrollPin"
import styles from "./HomeWays.module.css"
import SampleTag from "./SampleTag"

// 그래프 줄에 그릴 태그 수 (자료가 많은 순). 아래 "이웃 태그 n개"는 그리지 않은 태그까지 센 실제 수다
const WAYS_MAX_TAGS = 16
// AI 줄 그래프에 그릴 태그 수
const ASK_MAX_TAGS = 30
// 목록 줄에 보여 줄 결과 수, AI 줄에 보여 줄 결과 수
const LIST_ROWS = 5
const ASK_ROWS = 3
// 다시 묶기 줄에 보여 줄 자료 수
const REGROUP_GOAL = "시험 공부용으로 다시 분류해줘"

// p(0~1)에서 [a, b] 구간의 진행도 (0~1)
function seg(p, a, b) {
  return Math.max(0, Math.min(1, (p - a) / (b - a)))
}

function typed(text, t) {
  return text.slice(0, Math.ceil(t * text.length))
}

function lower(tags) {
  return (tags ?? []).map((t) => String(t).toLowerCase())
}

// 한 줄: 그림과 설명. 짝수 줄은 좌우를 바꾼다. 그림은 진행도 p를 받아 그린다
function Row({ flip, title, desc, extra, children }) {
  const ref = useRef(null)
  const p = useViewProgress(ref)
  return (
    <article
      ref={ref}
      className={flip ? `${styles.row} ${styles.flip}` : styles.row}
      style={{ "--p": p }}
    >
      <div className={styles.visual}>{children(p)}</div>
      <div className={styles.text}>
        <h3>{title}</h3>
        <p>{desc}</p>
        {extra}
      </div>
    </article>
  )
}

function Item({ item, style }) {
  return (
    <li className={styles.item} style={style}>
      <i style={{ background: categoryColor(item.category) }} aria-hidden="true" />
      <span>{item.title}</span>
    </li>
  )
}

// 1. 그래프로: 처음에는 전체 모습, 진행하면 태그 하나를 골라 확대한다
function GraphVisual({ graph, demo, p, sample }) {
  const draw = useMemo(() => pickTags(graph, WAYS_MAX_TAGS, demo ? [demo.id] : []), [graph, demo])
  const canvasRef = useRef(null)
  const graphRef = useRef(null)
  const focused = p > 0.4

  useEffect(() => {
    if (!canvasRef.current || draw.nodes.length === 0) return
    if (!graphRef.current) {
      graphRef.current = create(canvasRef.current, {
        data: draw,
        scale: 0.4,
        labels: "big",
        labelMin: 1,
        labelMax: 10,
        dust: 40,
        seed: 8,
        speed: 0.04,
        fontSize: 12,
      })
    } else {
      graphRef.current.setData(draw, true)
    }
  }, [draw])
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
    g.select(focused ? demo.id : null)
    g.view(focused ? { focus: demo.id, zoom: 1.6 } : { focus: null, zoom: 1 })
  }, [demo, focused, draw])

  const neighbors = demo
    ? graph.links.filter((l) => l.source === demo.id || l.target === demo.id).length
    : 0

  return (
    <>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <p className={styles.cap} aria-live="polite">
        {sample && "예시 자료 · "}
        {demo && focused ? (
          <>
            <b>#{demo.label}</b> 자료 {demo.count}건, 이웃 태그 {neighbors}개
          </>
        ) : (
          `태그 ${graph.nodes.length}개. 같은 자료에 함께 붙은 태그끼리 이어집니다`
        )}
      </p>
    </>
  )
}

// 2. 목록으로: 검색어를 쳐 가면서 목록이 줄어든다
// contents: 시연에 쓰는 자료 / mine: 내 자료 (직접 입력하면 언제나 여기서 찾는다)
function ListVisual({ contents, mine, sample, demoWord, p }) {
  const [query, setQuery] = useState("")
  const [touched, setTouched] = useState(false)
  const navigate = useNavigate()
  const shown = touched ? query : typed(demoWord, seg(p, 0.15, 0.55))
  // 직접 입력하면 내 자료에서 찾는다 (홈에서 본 건수와 전체 자료에서 본 건수가 같게)
  const data = touched ? mine : contents
  const { items } = useLibraryFilter(data, shown, null)
  const empty = touched && mine.length === 0

  function submit(e) {
    e.preventDefault()
    if (empty) return
    const q = shown.trim()
    navigate("/library", { state: q ? { q } : null })
  }

  let caption
  if (touched) caption = shown ? `내 자료에서 '${shown}' ${items.length}건` : `내 자료 ${mine.length}건`
  else if (sample) caption = shown ? `예시 자료 · '${shown}' ${items.length}건` : `예시 자료 ${contents.length}건`
  else caption = shown ? `시연: '${shown}' ${items.length}건` : `전체 ${contents.length}건`

  return (
    <div className={styles.pad}>
      <form onSubmit={submit}>
        <label className={styles.sr} htmlFor="ways-list">
          전체 자료에서 찾을 단어
        </label>
        <input
          id="ways-list"
          className={styles.input}
          type="search"
          value={shown}
          onFocus={() => {
            if (!touched) {
              setTouched(true)
              setQuery("")
            }
          }}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            mine.length === 0 ? "자료를 추가하면 찾을 수 있습니다" : sample ? `내 자료 ${mine.length}건에서 찾기` : "단어를 입력하세요"
          }
          autoComplete="off"
        />
      </form>
      {empty ? (
        <p className={styles.n}>
          아직 저장한 자료가 없습니다.{" "}
          <Link to="/add" className={styles.inlineLink}>
            자료 추가
          </Link>
        </p>
      ) : (
        <>
          <p className={styles.n}>{caption}</p>
          <ul className={styles.list}>
            {items.slice(0, LIST_ROWS).map((it, i) => (
              <Item key={it.id} item={it} style={{ "--i": i }} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// 3. AI에게: 질문 → 질문에서 뽑은 태그와 카테고리 → 찾은 자료가 그래프에서 빛난다
function AskVisual({ contents, graph, demo, p, sample }) {
  const question = demo ? `${demo.label} 관련해서 저장한 자료 찾아줘` : "지난주에 저장한 자료 찾아줘"
  const found = useMemo(() => {
    if (!demo) return []
    return [...contents].filter((c) => lower(c.tags).includes(demo.id)).sort(byNewest)
  }, [contents, demo])
  // 찾은 자료에 가장 많은 카테고리 (AI가 질문에서 뽑았다고 보여 주는 값)
  const cat = useMemo(() => {
    const n = {}
    for (const c of found) n[c.category] = (n[c.category] ?? 0) + 1
    return Object.keys(n).sort((a, b) => n[b] - n[a])[0] ?? null
  }, [found])
  const lit = useMemo(() => new Set(found.flatMap((c) => lower(c.tags))), [found])
  const draw = useMemo(() => pickTags(graph, ASK_MAX_TAGS, [...lit]), [graph, lit])

  const q = seg(p, 0.05, 0.35)
  const showChips = p > 0.4
  const showFound = p > 0.55

  const canvasRef = useRef(null)
  const graphRef = useRef(null)
  useEffect(() => {
    if (!canvasRef.current || draw.nodes.length === 0) return
    if (!graphRef.current) {
      graphRef.current = create(canvasRef.current, {
        data: draw,
        scale: 0.42,
        cx: 0.62,
        labels: "lit",
        labelTint: true,
        dust: 50,
        seed: 17,
        speed: 0.05,
        fontSize: 12,
      })
    } else {
      graphRef.current.setData(draw, true)
    }
  }, [draw])
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
    g.setHighlight(showFound ? lit : null)
    g.view(showFound ? { focus: demo.id, zoom: 1.25 } : { focus: null, zoom: 0.9 })
    if (showFound) g.pulse(demo.id)
  }, [demo, lit, showFound, draw])

  return (
    <>
      <canvas
        ref={canvasRef}
        className={showFound ? `${styles.canvas} ${styles.dimIn}` : `${styles.canvas} ${styles.dim}`}
        aria-hidden="true"
      />
      <div className={styles.askTop}>
        <p className={styles.bubble}>
          {typed(question, q) || " "}
          {q > 0 && q < 1 && <span className={styles.caret} aria-hidden="true" />}
        </p>
        <div className={showChips ? `${styles.chips} ${styles.chipsOn}` : styles.chips}>
          <span className={styles.chipLabel}>AI가 뽑은 것</span>
          {demo && <span className={styles.chip}>태그 #{demo.label}</span>}
          {cat && (
            <span className={styles.chip}>
              <i style={{ background: categoryColor(cat) }} aria-hidden="true" />
              카테고리 {cat}
            </span>
          )}
        </div>
      </div>
      <div className={showFound ? `${styles.found} ${styles.foundOn}` : styles.found}>
        <p className={styles.n}>
          {sample ? "예시 자료 · " : "시연: "}
          {demo ? `#${demo.label} 태그로 찾은 자료 ${found.length}건` : `찾은 자료 ${found.length}건`}
        </p>
        <ul className={styles.list}>
          {found.slice(0, ASK_ROWS).map((it, i) => (
            <Item key={it.id} item={it} style={{ "--i": i }} />
          ))}
        </ul>
      </div>
    </>
  )
}

// 4. 다시 묶기: 목적을 적으면 자료마다 바꿀 안이 하나씩 나타난다
// 언제나 예시 자료로 보여 준다. 바꿀 안은 AI가 만드는 것이라, 내 자료 제목에 지어낸 안을 붙이지 않는다
const REGROUP_ROWS_DATA = SAMPLE_REGROUP.map((c) => {
  const change = ["참고", "도구", "기타"].includes(c.category)
  return { item: c, to: change ? "학습" : c.category, change }
})

function RegroupVisual({ p }) {
  const rows = REGROUP_ROWS_DATA
  const changes = rows.filter((r) => r.change).length
  const g = seg(p, 0.05, 0.3)

  return (
    <div className={styles.pad}>
      <SampleTag>예시 자료</SampleTag>
      <p className={styles.goal}>
        <span className={styles.goalLabel}>목적</span>
        {typed(REGROUP_GOAL, g) || " "}
      </p>
      <p className={styles.n}>
        {p < 0.35 ? " " : p < 0.85 ? "예시 자료 · 최근 자료부터 15건씩 검토하는 중" : `예시 자료 · 바꿀 안 ${changes}건`}
      </p>
      <ul className={styles.regroup}>
        {rows.map((r, i) => {
          const on = p > 0.4 + i * 0.12
          return (
            <li key={r.item.id} className={on ? styles.rgOn : undefined}>
              <span className={styles.rgTitle}>{r.item.title}</span>
              <span className={styles.rgCats}>
                <span className={styles.cat}>
                  <i style={{ background: categoryColor(r.item.category) }} aria-hidden="true" />
                  {r.item.category}
                </span>
                {r.change ? (
                  <>
                    <span className={styles.arrow} aria-hidden="true">
                      →
                    </span>
                    <span className={`${styles.cat} ${styles.catNew}`}>
                      <i style={{ background: categoryColor(r.to) }} aria-hidden="true" />
                      {r.to}
                    </span>
                  </>
                ) : (
                  <span className={styles.keep}>그대로</span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      <p className={styles.note}>예시 화면입니다. 실제 안과 이유는 AI가 자료마다 만들고, 적용을 눌러야 바뀝니다.</p>
    </div>
  )
}

// mine: 내 자료 (홈이 불러온 그대로)
function HomeWays({ mine }) {
  const navigate = useNavigate()
  const [question, setQuestion] = useState("")

  // 내 자료가 시연할 만큼 모였으면 내 자료로, 아니면 예시 자료로 보여 준다
  // 세 줄(그래프, 목록, AI)이 함께 따라갈 태그도 여기서 정한다
  const real = useMemo(() => waysData(mine), [mine])
  const sample = !real.rich
  const contents = sample ? SAMPLE_CONTENTS : mine
  const graph = sample ? SAMPLE_GRAPH : real.graph
  const demo = sample ? SAMPLE_DEMO : real.demo
  const noItems = mine.length === 0

  // 제목 떠오름, 실 그리기 진행도
  const headRef = useRef(null)
  const rowsRef = useRef(null)
  const headP = useViewProgress(headRef, { startAt: 0.95, span: 1.6 })
  const threadP = useViewProgress(rowsRef, { startAt: 0.55, span: 1 })

  function submitAsk(e) {
    e.preventDefault()
    const q = question.trim()
    // 자료가 없으면 찾을 것이 없어 AI 사용량만 쓴다
    if (!q || noItems) return
    navigate("/graph", { state: { q } })
  }

  return (
    <section className={styles.sec} aria-labelledby="ways-title">
      <div ref={headRef} className={styles.head} style={{ "--in": headP }}>
        {sample && <SampleTag />}
        <h2 className={styles.h2} id="ways-title">
          찾고, 다시 분류합니다
        </h2>
        <p className={styles.lead}>
          그래프에 익숙하지 않아도 됩니다. 목록에서 단어로 거르거나 기억나는 대로 AI에게 물어도 같은
          자료에 닿고, 쌓인 자료는 목적에 맞게 분류를 다시 검토할 수 있습니다.
        </p>
        {/* 위 통계는 내 자료인데 여기만 예시인 이유와, 무엇이 채워지면 내 자료로 바뀌는지 */}
        {sample && (
          <div className={styles.why}>
            {noItems ? (
              <p>첫 자료를 저장하고 자료가 쌓이면 이 구간도 내 자료로 바뀝니다.</p>
            ) : (
              <>
                <p>
                  아직 예시 자료로 보여 줍니다. 자료가 {RICH.items}건 이상 모이고 태그끼리 이어지면 내 자료로 바뀝니다.
                  지금 {mine.length}건
                </p>
                <p>목록 입력칸에 직접 쓰면 언제나 내 자료에서 찾습니다.</p>
              </>
            )}
            <p>분류 다시 검토는 AI가 안을 만들어야 해서 언제나 예시로 보여 줍니다.</p>
          </div>
        )}
      </div>

      <div ref={rowsRef} className={styles.rows} style={{ "--t": threadP }}>
        <Row
          title="그래프로"
          desc="태그를 고르면 그 태그와 이어진 이웃만 남습니다. 함께 붙은 태그를 따라가다 보면 잊고 있던 자료가 나옵니다."
          extra={
            <Link to="/graph" className={styles.more}>
              {sample ? "내 지식 그래프 열기" : "지식 그래프 열기"}
            </Link>
          }
        >
          {(p) => <GraphVisual graph={graph} demo={demo} p={p} sample={sample} />}
        </Row>

        <Row
          flip
          title="목록으로"
          desc="AI 없이 단어로 바로 거릅니다. 제목, 요약, 태그, 메모를 한 번에 찾습니다."
          extra={
            <Link to="/library" className={styles.more}>
              {sample ? "내 전체 자료에서 보기" : "전체 자료에서 보기"}
            </Link>
          }
        >
          {(p) => (
            <ListVisual contents={contents} mine={mine} sample={sample} demoWord={demo?.label ?? ""} p={p} />
          )}
        </Row>

        <Row
          title="AI에게"
          desc="기억나는 대로 물으면 AI가 질문에서 카테고리, 태그, 핵심어를 뽑아 찾습니다. 찾은 자료는 지식 그래프에서 빛납니다."
          extra={
            <form onSubmit={submitAsk} className={styles.askForm}>
              <label className={styles.sr} htmlFor="ways-ask">
                AI에게 물어볼 질문
              </label>
              <input
                id="ways-ask"
                className={styles.input}
                maxLength={200}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={
                  noItems
                    ? "자료를 추가하면 물어볼 수 있습니다"
                    : sample
                      ? `내 자료 ${mine.length}건에 물어보세요`
                      : "기억나는 대로 물어보세요"
                }
                disabled={noItems}
                autoComplete="off"
              />
              <button type="submit" className={styles.askBtn} disabled={noItems || !question.trim()}>
                찾기
              </button>
            </form>
          }
        >
          {(p) => <AskVisual contents={contents} graph={graph} demo={demo} p={p} sample={sample} />}
        </Row>

        <Row
          flip
          title="분류 다시 검토"
          desc="목적을 적으면 AI가 최근 자료부터 15건씩 다시 검토해 카테고리와 태그를 바꿀 안과 이유를 보여 줍니다. 적용을 누르기 전에는 아무것도 바뀌지 않습니다."
          extra={
            <Link to="/graph" className={styles.more}>
              {sample ? "내 지식 그래프에서 분류 다시 검토 열기" : "지식 그래프에서 분류 다시 검토 열기"}
            </Link>
          }
        >
          {(p) => <RegroupVisual p={p} />}
        </Row>
      </div>
    </section>
  )
}

export default HomeWays
