// 홈 세 번째 구역: 저장한 날짜 순서대로 그래프를 다시 그린다
// 화면에 들어오면 한 번 저절로 재생한다. 재생 버튼이나 막대로 직접 움직일 수도 있다
import { useEffect, useMemo, useRef, useState } from "react"
import { create, reducedMotion, tagGraph } from "../../lib/threadGraph"
import ways from "./HomeWays.module.css"
import styles from "./HomeTimeline.module.css"

// 날짜 눈금 수 (양 끝 포함)
const TICK_COUNT = 5
// 전체 재생에 쓰는 시간 (ms). 날짜가 많으면 한 칸이 짧아진다
const PLAY_TOTAL_MS = 9000

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

function HomeTimeline({ contents }) {
  // 자료를 저장한 날짜 (오래된 순)
  const days = useMemo(
    () => [...new Set(contents.map((c) => dayOf(c.createdAt)).filter(Boolean))].sort(),
    [contents]
  )
  const last = days.length - 1
  const [cur, setCur] = useState(null) // 보고 있는 날짜 순번. null이면 마지막 날 (처음에는 전체를 보여 준다)
  const [playing, setPlaying] = useState(false)
  const shown = cur == null ? last : Math.min(cur, last)
  const shownRef = useRef(shown) // 재생 타이머가 지금 날짜를 읽는 용도
  useEffect(() => {
    shownRef.current = shown
  })

  const upto = useMemo(() => {
    const d = days[shown]
    return d ? contents.filter((c) => (dayOf(c.createdAt) ?? "") <= d) : []
  }, [contents, days, shown])
  const graph = useMemo(() => tagGraph(toItems(upto)), [upto])

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

  // 화면에 처음 들어오면 한 번 재생한다
  useEffect(() => {
    const el = boxRef.current
    if (!el || reducedMotion() || last < 1) return
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
  }, [last])

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
    <section className={ways.sec} style={{ paddingTop: 40 }} aria-labelledby="grow-title">
      <h2 className={ways.h2} id="grow-title">
        지식이 자라는 모습
      </h2>
      <p className={ways.lead}>
        저장한 날짜 순서대로 그래프를 다시 그립니다. 재생을 누르거나 막대를 끌어 보세요. 새 태그가
        생긴 날에는 그 자리에서 점이 자라납니다.
      </p>
      <div ref={boxRef} className={styles.box}>
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        <div className={styles.date} aria-live="polite">
          <b>{shortDay(days[shown])}</b>
          <span>
            자료 {upto.length}건, 태그 {graph.nodes.length}개
          </span>
        </div>
        <div className={styles.ctl}>
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
              setPlaying(false)
              setCur(Number(e.target.value))
            }}
          />
        </div>
        <div className={styles.ticks} aria-hidden="true">
          {ticks.map((d) => (
            <span key={d}>{shortDay(d)}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HomeTimeline
