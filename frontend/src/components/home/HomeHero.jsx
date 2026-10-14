// 홈 첫 화면: 왼쪽은 링크 입력, 오른쪽은 저장한 자료를 한 장씩 넘겨 보는 카드 더미, 뒤에는 태그 그래프
// 앞에 선 카드의 태그가 그래프에서 빛난다. 넓은 화면에서는 이 구역이 화면에 고정된 채 스크롤에 따라 카드가 넘어간다
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { byNewest } from "../../hooks/useLibraryFilter"
import { categoryColor } from "../../constants/categories"
import { canPin } from "../../lib/scrollPin"
import { create, reducedMotion } from "../../lib/threadGraph"
import { hostOf, kindOf, tagName } from "../../lib/contentMeta"
import styles from "./HomeHero.module.css"
import SampleTag from "./SampleTag"

// 더미에 꽂을 자료 수 (최근 순). 전체는 "전체 자료"에서 본다
const CRATE_COUNT = 12
// 앞 카드 양옆으로 보이는 카드 수
const SIDE_VISIBLE = 2
// 저절로 넘기는 간격 (ms). 사용자가 한 번이라도 조작하면 멈춘다
const AUTO_MS = 4000
// 스크롤로 넘기는 카드 수. 나머지는 끌거나 화살표로 넘긴다
const SCROLL_SPAN = 7
// 스크롤로 넘기는 동안 화면에 고정되는 길이 (첫 화면 높이의 배수)
const PIN_SCREENS = 3
// 그래프 이름표가 피해 갈 여백 (px)
const LABEL_MARGIN = 10
// 위 메뉴 줄 높이 + 여백 (px). 메뉴는 페이지 맨 위에 겹쳐 있다가 스크롤하면 함께 올라간다
const NAV_AVOID = 76

// 카드 배치: 앞 카드에서 n번째 떨어진 카드의 가로 위치(카드 폭의 배수)와 크기
const SIDE_X = [0, 0.34, 0.56, 0.72]
const SIDE_SCALE = [1, 0.86, 0.76, 0.68]

function lerpAt(table, d) {
  const i = Math.min(Math.floor(d), table.length - 2)
  const t = Math.min(1, d - i)
  return table[i] + (table[i + 1] - table[i]) * t
}

function shortDate(s) {
  const m = String(s ?? "").match(/^\d{4}-(\d{2})-(\d{2})/)
  return m ? `${m[1]}.${m[2]}` : ""
}

// "https://www.kubernetes.io/ko/docs/" → "kubernetes.io/ko/docs"
function shortUrl(url) {
  if (!url) return "PDF"
  try {
    const u = new URL(url)
    return (hostOf(url) + u.pathname).replace(/\/$/, "")
  } catch {
    return url
  }
}


// sample: 자료가 없어 예시 자료로 그릴 때 (카드는 링크를 열지 않는다)
function HomeHero({ contents, graph, loading, error, sample }) {
  const navigate = useNavigate()
  const [url, setUrl] = useState("")
  const [formError, setFormError] = useState(null)
  const [active, setActive] = useState(0)

  const cards = useMemo(() => [...contents].sort(byNewest).slice(0, CRATE_COUNT), [contents])

  // 태그 이름(소문자) → 그래프에서 쓰는 색. 카드의 태그 칩과 그래프의 점 색을 맞춘다
  const tagColor = useMemo(() => {
    const m = new Map()
    for (const n of graph.nodes) m.set(n.id, categoryColor(n.cat))
    return m
  }, [graph])

  const journeyRef = useRef(null)
  const heroRef = useRef(null)
  const headRef = useRef(null)
  const crateRef = useRef(null)
  const countRef = useRef(null)
  const cardRefs = useRef([])
  const canvasRef = useRef(null)
  const graphRef = useRef(null)
  const activeRef = useRef(0)
  // 넘기는 위치: pos는 화면에 보이는 값, target은 가려는 값 (pos가 target을 따라간다)
  const motion = useRef({ pos: 0, target: 0, manual: false, dragged: false, hover: false })

  // 뒤의 그래프
  useEffect(() => {
    if (!canvasRef.current || graph.nodes.length === 0) return
    // 그래프 이름표가 피해 갈 영역: 위 메뉴 줄, 왼쪽 글, 몇 번째 표시, 앞 카드와 바로 옆 카드
    function labelAvoid() {
      const cv = canvasRef.current
      if (!cv) return []
      const o = cv.getBoundingClientRect()
      const menu = { l: -1e4, r: 1e4, t: -1e4, b: NAV_AVOID - window.scrollY - o.top }
      const els = [headRef.current, countRef.current]
      const a = activeRef.current
      for (let i = a - 1; i <= a + 1; i++) els.push(cardRefs.current[i])
      const rects = els.filter(Boolean).map((el) => {
        const r = el.getBoundingClientRect()
        return {
          l: r.left - o.left - LABEL_MARGIN,
          r: r.right - o.left + LABEL_MARGIN,
          t: r.top - o.top - LABEL_MARGIN,
          b: r.bottom - o.top + LABEL_MARGIN,
        }
      })
      return [menu, ...rects]
    }
    if (!graphRef.current) {
      // 좁은 화면: 제목 글자 뒤로 빛이 번지지 않게 오른쪽 위 구석에 작게 둔다
      const narrow = window.matchMedia("(max-width: 900px)").matches
      graphRef.current = create(canvasRef.current, {
        data: graph,
        // 카드 더미 위쪽 빈 곳에 작게 모은다. 카드 뒤로 숨는 태그가 적어야 앞 카드의 태그 이름이 보인다
        scale: narrow ? 0.2 : 0.3,
        // 노드 크기는 유지하고 가로 방향으로만 조금 더 펼친다
        spreadX: narrow ? 1 : 1.55,
        cx: narrow ? 0.8 : 0.7,
        cy: narrow ? 0.09 : 0.22,
        // 앞 카드의 태그에만 이름을 단다. 글과 카드에 걸리는 이름은 비키거나 뺀다
        labels: "lit",
        labelTint: true,
        fontSize: 13,
        avoid: labelAvoid,
        dust: 160,
        seed: 5,
        speed: 0.03,
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
    activeRef.current = active
    const g = graphRef.current
    const card = cards[active]
    if (!g || !card) return
    const ids = (card.tags ?? []).map((t) => tagName(t).toLowerCase())
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
    let cw = 0

    function place() {
      m.target = Math.max(0, Math.min(n - 1, m.target))
      m.pos += (m.target - m.pos) * (reduced ? 1 : 0.12)
      if (!cw) cw = cardRefs.current[0]?.offsetWidth || 340
      const f = m.pos
      for (let i = 0; i < n; i++) {
        const el = cardRefs.current[i]
        if (!el) continue
        const d = i - f
        const ad = Math.abs(d)
        const x = Math.sign(d) * lerpAt(SIDE_X, ad) * cw
        const s = lerpAt(SIDE_SCALE, ad)
        el.style.transform = `translate3d(${x.toFixed(1)}px,0,0) scale(${s.toFixed(3)})`
        el.style.zIndex = String(200 - Math.round(ad * 10))
        el.style.opacity = String(Math.max(0, Math.min(1, 1 - (ad - SIDE_VISIBLE))))
        el.style.visibility = ad > SIDE_VISIBLE + 1 ? "hidden" : "visible"
        // 뒤로 물러난 카드는 어둡게, 테두리 빛은 약하게
        el.style.setProperty("--shade", Math.min(0.62, ad * 0.48).toFixed(3))
        el.style.setProperty("--rim", Math.max(0, 1 - ad).toFixed(3))
      }
      const i = Math.round(f)
      if (i !== lastI) {
        lastI = i
        setActive(i)
      }
      raf = requestAnimationFrame(place)
    }
    place()

    function onResize() {
      cw = 0
    }
    window.addEventListener("resize", onResize)

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
      window.removeEventListener("resize", onResize)
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
    if (!u) {
      setFormError("저장할 링크를 넣어 주세요")
      return
    }
    if (!/^https?:\/\//i.test(u)) {
      setFormError("http:// 또는 https://로 시작하는 주소를 입력하세요")
      return
    }
    // 분석과 저장은 자료 추가 화면이 맡는다. 결과를 확인한 뒤에 저장한다
    navigate("/add", { state: { url: u } })
  }

  const total = cards.length
  const focused = cards[active]
  // 앞 카드의 태그 중 그래프에 있는 것 (그래프에서 빛나는 수)
  const litCount = focused
    ? (focused.tags ?? []).filter((t) => tagColor.has(tagName(t).toLowerCase())).length
    : 0

  return (
    <div ref={journeyRef} className={styles.journey}>
      <section ref={heroRef} className={styles.hero} aria-label="읽은 것을 한 상자에">
        <div className={styles.aura} aria-hidden="true" />
        <canvas ref={canvasRef} className={styles.graph} aria-hidden="true" />

        <div ref={headRef} className={styles.head}>
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
              placeholder="https://fastapi.tiangolo.com"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setFormError(null)
              }}
              aria-invalid={formError ? "true" : undefined}
              aria-describedby={formError ? "home-url-error" : "home-url-help"}
            />
            <button type="submit" className={styles.submit}>
              분석 시작
            </button>
          </form>
          {formError ? (
            <p id="home-url-error" className={styles.error} role="alert">
              {formError}
            </p>
          ) : (
            <p id="home-url-help" className={styles.help}>
              {sample
                ? "카드와 그래프는 예시입니다. 첫 링크를 저장하면 내 자료로 바뀝니다."
                : total > 0
                  ? "카드는 끌거나 화살표로 넘깁니다. 앞에 선 자료의 태그가 그래프에서 빛납니다."
                  : "PDF는 자료 추가에서 올립니다."}
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
          <div className={styles.stage}>
            {sample && (
              <div className={styles.sampleTag}>
                <SampleTag>예시 자료</SampleTag>
              </div>
            )}
            <div
              ref={crateRef}
              className={styles.crate}
              tabIndex={0}
              role="group"
              aria-roledescription="자료 더미"
              aria-label="최근 저장한 자료. 왼쪽, 오른쪽 화살표로 넘깁니다"
              onKeyDown={handleKeyDown}
              onPointerEnter={() => (motion.current.hover = true)}
              onPointerLeave={() => (motion.current.hover = false)}
              onFocus={() => (motion.current.manual = true)}
            >
              {cards.map((c, i) => {
                const color = categoryColor(c.category)
                const tags = (c.tags ?? []).map(tagName).slice(0, 3)
                const body = (
                  <>
                    <span className={styles.kind}>
                      <span>
                        {kindOf(c.url).label}, {c.category ?? "기타"}
                      </span>
                      <span className={styles.date}>{shortDate(c.createdAt)}</span>
                    </span>
                    <b className={styles.cardTitle}>{c.title}</b>
                    <span className={styles.src}>{shortUrl(c.url)}</span>
                    {c.summary && <span className={styles.summary}>{c.summary}</span>}
                    {tags.length > 0 && (
                      <span className={styles.tags}>
                        {tags.map((t) => (
                          <span
                            key={t}
                            className={styles.chip}
                            style={{ "--c": tagColor.get(t.toLowerCase()) ?? categoryColor(null) }}
                          >
                            {t}
                          </span>
                        ))}
                      </span>
                    )}
                  </>
                )
                const common = {
                  ref: (el) => (cardRefs.current[i] = el),
                  className: styles.card,
                  style: { "--cat": color },
                  draggable: false,
                  tabIndex: i === active ? 0 : -1,
                  "aria-hidden": i === active ? undefined : "true",
                  onClick: (e) => handleCardClick(e, i),
                }
                // 예시 카드는 아무 곳도 열지 않는다 (예시 주소는 실제 페이지가 아니다)
                if (sample) {
                  return (
                    <div key={c.id} {...common}>
                      {body}
                    </div>
                  )
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
                  <Link
                    key={c.id}
                    {...common}
                    to="/library"
                    aria-label={`${c.title}, 전체 자료에서 보기`}
                  >
                    {body}
                  </Link>
                )
              })}
            </div>

            <p ref={countRef} className={styles.count} aria-live="polite">
              <b>{String(active + 1).padStart(2, "0")}</b>
              <span>/ {String(total).padStart(2, "0")}</span>
              <span className={styles.sr}>{focused ? `, ${focused.title}` : ""}</span>
            </p>

            <div className={styles.bottom}>
              <p className={styles.lit}>
                <span className={styles.litIcon} aria-hidden="true">
                  <i />
                  <i />
                </span>
                {litCount > 0
                  ? `태그 ${litCount}개가 위 그래프에서 빛납니다`
                  : "이 자료의 태그는 아직 그래프에 없습니다"}
              </p>
              <div className={styles.arrows}>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  disabled={active === 0}
                  aria-label="앞 자료"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <path
                      d="M11 3L5 9l6 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  disabled={active === total - 1}
                  aria-label="다음 자료"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <path
                      d="M7 3l6 6-6 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default HomeHero
