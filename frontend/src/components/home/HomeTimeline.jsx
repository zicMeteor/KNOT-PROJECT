// 홈 세 번째 구역: 저장한 날짜 순서대로 그래프를 다시 그린다
// 화면에 들어오면 한 번 저절로 재생한다. 재생 버튼이나 막대로 직접 움직일 수도 있다
// 넓은 화면: 구역이 화면에 고정되고, 스크롤한 만큼 날짜가 넘어간다 (내리면 자라고, 올리면 줄어든다)
import { useEffect, useMemo, useRef, useState } from "react"
import { create, reducedMotion, tagGraph, topTags } from "../../lib/threadGraph"
import { usePinProgress, useViewProgress } from "../../lib/scrollPin"
import ways from "./HomeWays.module.css"
import styles from "./HomeTimeline.module.css"
import SampleTag from "./SampleTag"

// 날짜 눈금 수 (양 끝 포함)
const TICK_COUNT = 5
// 전체 재생에 쓰는 시간 (ms). 날짜가 많으면 한 칸이 짧아진다
const PLAY_TOTAL_MS = 9000
// 스크롤 고정 구간 길이 (화면 높이의 배수)
const TIMELINE_SCREENS = 3

function dayOf(s) {
  const m = String(s ?? "").match(/^\d{4}-\d{2}-\d{2}/)
  return m ? m[0] : null
}

function shortDay(d) {
  return d.slice(5).replace("-", ".")
}

function toItems(list) {
  return list.map((c) => ({ cat: c.category, tags: c.tags ?? [] }))
}

// 그릴 태그 수 상한. 보고 있는 날짜에 저장한 자료의 태그는 수와 상관없이 남긴다 (그날 새로 자라는 점이 보이게)
const TIMELINE_MAX_TAGS = 80

// myDays: 내 자료를 저장한 날 수 (내 자료가 없으면 null)
function HomeTimeline({ contents, sample, myDays }) {
  // 자료를 저장한 날짜 (오래된 순)
  const days = useMemo(
    () => [...new Set(contents.map((c) => dayOf(c.createdAt)).filter(Boolean))].sort(),
    [contents]
  )
  const last = days.length - 1
  const [cur, setCur] = useState(null) // 보고 있는 날짜 순번. null이면 마지막 날 (처음에는 전체를 보여 준다)
  const [playing, setPlaying] = useState(false)

  const trackRef = useRef(null)
  const stageRef = useRef(null)
  const pin = usePinProgress(trackRef, stageRef, TIMELINE_SCREENS)
  // 구역이 화면에 들어오는 정도: 제목이 떠오르고 그래프 상자가 펼쳐진다
  const enter = useViewProgress(trackRef, { startAt: 1, span: 0.18 })

  // 스크롤 고정이면 스크롤 위치가 날짜를 정한다
  const shown = pin.on ? Math.round(pin.p * last) : cur == null ? last : Math.min(cur, last)
  const shownRef = useRef(shown) // 재생 타이머가 지금 날짜를 읽는 용도
  useEffect(() => {
    shownRef.current = shown
  })

  const upto = useMemo(() => {
    const d = days[shown]
    return d ? contents.filter((c) => (dayOf(c.createdAt) ?? "") <= d) : []
  }, [contents, days, shown])
  const graph = useMemo(() => {
    const today = upto.filter((c) => dayOf(c.createdAt) === days[shown])
    const keep = today.flatMap((c) => (c.tags ?? []).map((t) => String(t).toLowerCase()))
    return topTags(tagGraph(toItems(upto)), TIMELINE_MAX_TAGS, keep)
  }, [upto, days, shown])

  const boxRef = useRef(null)
  const canvasRef = useRef(null)
  const graphRef = useRef(null)
  const prevRef = useRef(shown)

  useEffect(() => {
    if (!canvasRef.current) return
    if (!graphRef.current) {
      graphRef.current = create(canvasRef.current, {
        data: graph,
        scale: 0.4,
        cx: window.innerWidth < 900 ? 0.5 : 0.56, // 좁은 화면에서는 날짜 글자가 위에 있으니 가운데로
        labels: "big",
        labelMin: 2,
        dust: 60,
        seed: 12,
        speed: 0.05,
      })
    } else if (shown > prevRef.current) {
      graphRef.current.grow(graph) // 새 태그만 그 자리에서 자라난다
    } else {
      graphRef.current.setData(graph, true)
    }
    prevRef.current = shown
  }, [graph, shown])

  useEffect(
    () => () => {
      graphRef.current?.destroy()
      graphRef.current = null
    },
    []
  )

  // 재생: 처음 날짜부터 하루씩 넘긴다
  useEffect(() => {
    if (!playing) return
    const ms = Math.max(250, Math.min(1100, PLAY_TOTAL_MS / Math.max(1, last)))
    const id = setInterval(() => {
      const next = shownRef.current + 1
      if (next > last) {
        setPlaying(false)
        return
      }
      shownRef.current = next
      setCur(next)
    }, ms)
    return () => clearInterval(id)
  }, [playing, last])

  // 화면에 처음 들어오면 한 번 재생한다 (스크롤 고정이면 스크롤이 재생을 대신한다)
  useEffect(() => {
    const el = boxRef.current
    if (!el || pin.on || reducedMotion() || last < 1) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return
        io.disconnect()
        setCur(0)
        setPlaying(true)
      },
      { threshold: 0.5 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [last, pin.on])

  function togglePlay() {
    if (playing) {
      setPlaying(false)
      return
    }
    if (shown >= last) setCur(0)
    setPlaying(true)
  }

  const ticks = useMemo(() => {
    if (days.length <= TICK_COUNT) return days
    return Array.from({ length: TICK_COUNT }, (_, i) => days[Math.round((i * last) / (TICK_COUNT - 1))])
  }, [days, last])

  if (days.length < 2) return null

  return (
    <section
      ref={trackRef}
      className={pin.on ? `${ways.sec} ${ways.pinned}` : ways.sec}
      style={pin.on ? { "--in": enter } : { paddingTop: 40, "--in": enter }}
      aria-labelledby="grow-title"
    >
      <div ref={stageRef} className={pin.on ? styles.stage : undefined}>
      {sample && (
        <div className={styles.enterH}>
          <SampleTag />
        </div>
      )}
      <h2 className={`${ways.h2} ${styles.enterH}`} id="grow-title">
        지식이 자라는 모습
      </h2>
      <p className={`${ways.lead} ${styles.enterH}`}>
        {pin.on
          ? "스크롤을 내리면 저장한 날짜 순서대로 그래프가 자랍니다. 새 태그가 생긴 날에는 그 자리에서 점이 자라납니다."
          : "저장한 날짜 순서대로 그래프를 다시 그립니다. 재생을 누르거나 막대를 끌어 보세요. 새 태그가 생긴 날에는 그 자리에서 점이 자라납니다."}
      </p>
      {/* 내 자료가 있어도 저장한 날이 하루뿐이면 예시로 보여 준다. 언제 내 자료로 바뀌는지 알린다 */}
      {sample && myDays != null && (
        <div className={`${ways.why} ${styles.enterH}`}>
          <p>저장한 날이 이틀 이상이 되면 내 자료로 바뀝니다. 지금 {myDays}일</p>
        </div>
      )}
      <div ref={boxRef} className={styles.box}>
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        <div className={styles.date} aria-live="polite">
          <b>{shortDay(days[shown])}</b>
          <span>
            자료 {upto.length}건, 태그 {graph.nodes.length}개
          </span>
        </div>
        <div className={styles.ctl}>
          {!pin.on && (
          <button
            type="button"
            className={styles.play}
            onClick={togglePlay}
            aria-label={playing ? "멈춤" : "재생"}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              {playing ? (
                <>
                  <rect x="4" y="3" width="3.5" height="12" fill="currentColor" />
                  <rect x="10.5" y="3" width="3.5" height="12" fill="currentColor" />
                </>
              ) : (
                <path d="M5 3l10 6-10 6z" fill="currentColor" />
              )}
            </svg>
          </button>
          )}
          <label className={ways.sr} htmlFor="grow-range">
            날짜
          </label>
          <input
            id="grow-range"
            className={styles.range}
            type="range"
            min="0"
            max={last}
            step="1"
            value={shown}
            aria-valuetext={shortDay(days[shown])}
            onChange={(e) => {
              const v = Number(e.target.value)
              // 스크롤 고정이면 막대를 끌면 그 날짜 위치로 스크롤한다
              if (pin.on) {
                pin.seek(last > 0 ? v / last : 0)
                return
              }
              setPlaying(false)
              setCur(v)
            }}
          />
        </div>
        <div className={pin.on ? `${styles.ticks} ${styles.ticksWide}` : styles.ticks} aria-hidden="true">
          {ticks.map((d) => (
            <span key={d}>{shortDay(d)}</span>
          ))}
        </div>
      </div>
      </div>
    </section>
  )
}

export default HomeTimeline
