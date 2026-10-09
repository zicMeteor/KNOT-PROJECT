// 홈 첫 화면: 왼쪽은 링크 입력, 오른쪽은 저장한 자료를 레코드처럼 넘겨 보는 상자, 뒤에는 태그 그래프
// 넓은 화면에서는 이 구역이 화면에 고정된 채 스크롤에 따라 카드가 넘어간다
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { byNewest } from "../../hooks/useLibraryFilter"
import { categoryColor } from "../../constants/categories"
import { create, reducedMotion } from "../../lib/threadGraph"
import styles from "./HomeHero.module.css"

// 상자에 꽂을 자료 수 (최근 순). 전체는 "전체 자료"에서 본다
const CRATE_COUNT = 12
// 앞뒤로 보이는 카드 수
const SIDE_VISIBLE = 3
// 저절로 넘기는 간격 (ms). 사용자가 한 번이라도 조작하면 멈춘다
const AUTO_MS = 4000

function hostOf(url) {
  if (!url) return "PDF"
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function shortDate(s) {
  if (!s) return ""
  const m = String(s).match(/^\d{4}-(\d{2})-(\d{2})/)
  return m ? `${m[1]}.${m[2]}` : ""
}

// 스크롤로 넘기는 카드 수. 나머지는 끌거나 화살표로 넘긴다
const SCROLL_SPAN = 7
// 스크롤로 넘기는 동안 화면에 고정되는 길이 (첫 화면 높이의 배수)
const PIN_SCREENS = 3

// 스크롤 고정은 넓은 화면에서만 쓴다 (좁은 화면은 카드가 설명 아래로 내려가서 의미가 없다)
function canPin() {
  return !reducedMotion() && window.matchMedia("(min-width: 901px)").matches
}

function HomeHero({ contents, graph, loading, error }) {
  const navigate = useNavigate()
  const [url, setUrl] = useState("")
  const [formError, setFormError] = useState(null)
  const [active, setActive] = useState(0)

  const cards = useMemo(() => [...contents].sort(byNewest).slice(0, CRATE_COUNT), [contents])

  const journeyRef = useRef(null)
  const heroRef = useRef(null)
  const crateRef = useRef(null)
  const cardRefs = useRef([])
  const canvasRef = useRef(null)
  const graphRef = useRef(null)
  // 넘기는 위치: pos는 화면에 보이는 값, target은 가려는 값 (pos가 target을 따라간다)
  const motion = useRef({ pos: 0, target: 0, manual: false, dragged: false })

  // 뒤의 그래프
  useEffect(() => {
    if (!canvasRef.current || graph.nodes.length === 0) return
    if (!graphRef.current) {
      graphRef.current = create(canvasRef.current, {
        data: graph,
        // 왼쪽 글 밑으로 덜 넘어오게 오른쪽 상자 쪽에 모은다
        scale: 0.52,
        cx: 0.7,
        cy: 0.52,
        // 이름표는 왼쪽 입력창 위로 넘어와 겹치므로 그리지 않는다. 빛으로만 보여 준다
        labels: "none",
        dust: 140,
        seed: 5,
        speed: 0.035,
      })
    } else {
      graphRef.current.setData(graph, true)
    }
  }, [graph])

  useEffect(
    () => () => {
      graphRef.current?.destroy()
      graphRef.current = null
    },
    []
  )

  // 앞에 선 자료의 태그가 그래프에서 빛난다
  useEffect(() => {
    const g = graphRef.current
    const card = cards[active]
    if (!g || !card) return
    const ids = (card.tags ?? []).map((t) => String(t).toLowerCase())
    g.setHighlight(new Set(ids))
    ids.forEach((id) => g.pulse(id))
  }, [active, cards, graph])

  // 카드 배치: 매 프레임 transform만 바꾼다 (React 렌더링 없이)
  useEffect(() => {
    const n = cards.length
    if (n === 0) return
    const m = motion.current
    const reduced = reducedMotion()
    let raf = 0
    let lastI = -1

    function place() {
      m.target = Math.max(0, Math.min(n - 1, m.target))
      m.pos += (m.target - m.pos) * (reduced ? 1 : 0.12)
      const f = m.pos
      for (let i = 0; i < n; i++) {
        const el = cardRefs.current[i]
        if (!el) continue
        const d = i - f
        const ad = Math.abs(d)
        const s = d < 0 ? -1 : 1
        let x, ry, z
        if (ad < 1) {
          x = d * 250
          ry = -d * 58
          z = 200 * (1 - ad)
        } else {
          x = s * (250 + (ad - 1) * 44)
          ry = -s * 58
          z = -(ad - 1) * 30
        }
        el.style.transform = `translate3d(${x.toFixed(1)}px,0,${z.toFixed(1)}px) rotateY(${ry.toFixed(1)}deg)`
        el.style.zIndex = String(200 - Math.round(ad * 10))
        el.style.opacity = String(Math.max(0, Math.min(1, 1 - (ad - SIDE_VISIBLE) * 0.8)))
        el.style.visibility = ad > SIDE_VISIBLE + 1.3 ? "hidden" : "visible"
        // 옆으로 비낀 카드는 글자가 겹쳐 지저분해지므로 글자를 감추고 윗선만 남긴다
        el.style.setProperty("--body", String(Math.max(0, 1 - ad * 1.6)))
        el.style.setProperty("--title", String(Math.max(0, 1 - ad * 1.1)))
      }
      const i = Math.round(f)
      if (i !== lastI) {
        lastI = i
        setActive(i)
      }
      raf = requestAnimationFrame(place)
    }
    place()

    // 넓은 화면: 스크롤 위치가 카드를 넘긴다. 사용자가 직접 넘기면 그때부터는 스크롤이 카드를 움직이지 않는다
    // 그 밖: 저절로 넘긴다
    const journey = journeyRef.current
    const hero = heroRef.current
    let onScroll = null
    let timer = 0
    if (journey && hero && canPin()) {
      const span = Math.min(n - 1, SCROLL_SPAN)
      onScroll = () => {
        const ph = hero.offsetHeight
        journey.style.height = ph * PIN_SCREENS + "px"
        if (m.manual) return
        const r = journey.getBoundingClientRect()
        const p = Math.max(0, Math.min(1, -r.top / (ph * (PIN_SCREENS - 1))))
        m.target = p * span
      }
      window.addEventListener("scroll", onScroll, { passive: true })
      window.addEventListener("resize", onScroll)
      onScroll()
    } else if (!reduced) {
      timer = setInterval(() => {
        if (m.manual || m.hover) return
        m.target = (Math.round(m.target) + 1) % n
      }, AUTO_MS)
    }

    // 끌어서 넘기기
    const crate = crateRef.current
    let down = null
    function onDown(e) {
      down = { x: e.clientX, t: m.target, moved: false }
    }
    function onMove(e) {
      if (!down) return
      const dx = e.clientX - down.x
      if (Math.abs(dx) > 4) {
        down.moved = true
        m.manual = true
      }
      m.target = down.t - dx / 160
    }
    function onUp() {
      if (!down) return
      m.target = Math.round(m.target)
      m.dragged = down.moved
      down = null
    }
    crate?.addEventListener("pointerdown", onDown)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(timer)
      if (onScroll) {
        window.removeEventListener("scroll", onScroll)
        window.removeEventListener("resize", onScroll)
      }
      if (journey) journey.style.height = ""
      crate?.removeEventListener("pointerdown", onDown)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [cards])

  function go(step) {
    const m = motion.current
    m.manual = true
    m.target = Math.round(m.target) + step
  }

  function handleCardClick(e, i) {
    const m = motion.current
    // 끌다가 손을 뗀 것은 클릭으로 치지 않는다
    if (m.dragged) {
      e.preventDefault()
      m.dragged = false
      return
    }
    // 옆 카드를 누르면 앞으로 가져오기만 한다
    if (i !== active) {
      e.preventDefault()
      m.manual = true
      m.target = i
    }
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowRight") {
      e.preventDefault()
      go(1)
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      go(-1)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) {
      setFormError("http:// 또는 https://로 시작하는 주소를 입력하세요")
      return
    }
    // 분석과 저장은 자료 추가 화면이 맡는다. 결과를 확인한 뒤에 저장한다
    navigate("/add", { state: { url: u } })
  }

  const total = cards.length
  const focused = cards[active]

  return (
    <div ref={journeyRef} className={styles.journey}>
    <section ref={heroRef} className={styles.hero} aria-label="읽은 것을 한 상자에">
      <canvas ref={canvasRef} className={styles.graph} aria-hidden="true" />

      <div className={styles.head}>
        <h1 className={styles.title}>
          읽은 것을
          <br />한 상자에
        </h1>
        <p className={styles.sub}>
          링크를 넣으면 AI가 요약하고 분류해서, 이미 저장한 자료와 이어 줍니다. 저장은 결과를
          확인한 뒤에 합니다.
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.sr} htmlFor="home-url">
            저장할 링크
          </label>
          <input
            id="home-url"
            className={styles.input}
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setFormError(null)
            }}
            aria-invalid={formError ? "true" : undefined}
            aria-describedby={formError ? "home-url-error" : "home-url-help"}
          />
          <button type="submit" className={styles.submit} disabled={!url.trim()}>
            분석 시작
          </button>
        </form>
        {formError ? (
          <p id="home-url-error" className={styles.error} role="alert">
            {formError}
          </p>
        ) : (
          <p id="home-url-help" className={styles.help}>
            PDF는 <Link to="/add">자료 추가</Link>에서 올립니다.
            {total > 0 && " 카드는 끌거나 화살표로 넘깁니다."}
          </p>
        )}

        {contents.length > 0 && (
          <p className={styles.stats}>
            자료 {contents.length}건, 태그 {graph.nodes.length}개, 연결 {graph.links.length}개
            <span className={styles.statLinks}>
              <Link to="/graph">지식 그래프</Link>
              <Link to="/library">전체 자료</Link>
            </span>
          </p>
        )}
      </div>

      {loading ? (
        <p className={styles.state}>불러오는 중…</p>
      ) : error ? (
        <p className={styles.state}>{error}</p>
      ) : total === 0 ? (
        <div className={styles.state}>
          <p>아직 저장한 자료가 없습니다.</p>
          <p className={styles.stateSub}>
            왼쪽에 첫 링크를 넣어 보세요. 저장한 자료가 이 자리에 카드로 쌓입니다.
          </p>
        </div>
      ) : (
        <>
          <div
            ref={crateRef}
            className={styles.crate}
            tabIndex={0}
            role="group"
            aria-roledescription="자료 상자"
            aria-label="최근 저장한 자료. 왼쪽, 오른쪽 화살표로 넘깁니다"
            onKeyDown={handleKeyDown}
            onPointerEnter={() => (motion.current.hover = true)}
            onPointerLeave={() => (motion.current.hover = false)}
            onFocus={() => (motion.current.manual = true)}
          >
            {cards.map((c, i) => {
              const color = categoryColor(c.category)
              const body = (
                <>
                  <span className={styles.edge} style={{ background: color, color }} />
                  <span className={styles.kind}>
                    <span>
                      <i className={styles.dot} style={{ background: color }} />
                      {c.category ?? "기타"}
                    </span>
                    <span>{shortDate(c.createdAt)}</span>
                  </span>
                  <b className={styles.cardTitle}>{c.title}</b>
                  <span className={styles.more}>
                    <span className={styles.src}>{hostOf(c.url)}</span>
                    {c.summary && <span className={styles.summary}>{c.summary}</span>}
                    {c.tags?.length > 0 && (
                      <span className={styles.tags}>
                        {c.tags.slice(0, 4).map((t) => (
                          <span key={t} className={styles.chip}>
                            {t}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </>
              )
              const common = {
                ref: (el) => (cardRefs.current[i] = el),
                className: styles.card,
                draggable: false,
                tabIndex: i === active ? 0 : -1,
                "aria-hidden": i === active ? undefined : "true",
                onClick: (e) => handleCardClick(e, i),
              }
              // 앞에 선 카드: 링크가 있으면 원문을, PDF면 전체 자료를 연다
              return c.url ? (
                <a
                  key={c.id}
                  {...common}
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${c.title}, 원문 새 창으로 열기`}
                >
                  {body}
                </a>
              ) : (
                <Link key={c.id} {...common} to="/library" aria-label={`${c.title}, 전체 자료에서 보기`}>
                  {body}
                </Link>
              )
            })}
          </div>

          <div className={styles.controls}>
            <p className={styles.count} aria-live="polite">
              <b>{String(active + 1).padStart(2, "0")}</b>
              <span>/ {String(total).padStart(2, "0")}</span>
              <span className={styles.sr}>{focused ? `, ${focused.title}` : ""}</span>
            </p>
            <div className={styles.arrows}>
              <button type="button" onClick={() => go(-1)} disabled={active === 0} aria-label="앞 자료">
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M11 3L5 9l6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                disabled={active === total - 1}
                aria-label="다음 자료"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M7 3l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </section>
    </div>
  )
}

export default HomeHero
