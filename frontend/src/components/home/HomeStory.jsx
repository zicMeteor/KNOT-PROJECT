// 홈 스크롤리텔링 구역: 링크 하나가 저장되어 그래프에 이어지고, 나중에 다시 찾히기까지
// 넓은 화면: 구역이 화면에 고정되고, 스크롤에 따라 다섯 단계가 차례로 진행된다
// 좁은 화면, 움직임 줄이기: 고정 없이 단계 설명과 마지막 모습을 함께 보여 준다
import { useEffect, useMemo, useRef } from "react"
import { categoryColor } from "../../constants/categories"
import { byNewest } from "../../hooks/useLibraryFilter"
import { create, tagGraph, topTags } from "../../lib/threadGraph"
import { usePinProgress } from "../../lib/scrollPin"
import styles from "./HomeStory.module.css"

// 고정 구간 길이 (화면 높이의 배수). 단계 하나에 화면 한 장 정도
const STORY_SCREENS = 5
// 그래프에 그릴 태그 수 상한 (예시 자료의 태그는 수와 상관없이 남긴다)
const STORY_MAX_TAGS = 40

const STEPS = [
  { title: "링크를 넣습니다", desc: "읽던 페이지 주소나 PDF 하나면 됩니다." },
  { title: "AI가 읽고 요약합니다", desc: "본문을 추출해 300자 안으로 요약합니다. AI 분석은 자료당 한 번입니다." },
  { title: "카테고리와 태그를 붙입니다", desc: "이미 쓰던 태그가 있으면 새로 만들지 않고 그 태그를 다시 씁니다." },
  { title: "저장하면 그래프에 이어집니다", desc: "확인하고 저장한 자료만 남습니다. 같은 태그를 가진 자료와 실로 이어집니다." },
  { title: "나중에 물어서 찾습니다", desc: "기억나는 대로 물으면 AI가 질문에서 태그와 키워드를 뽑아 이 자료를 찾습니다." },
]

function lower(tags) {
  return (tags ?? []).map((t) => String(t).toLowerCase())
}

function shortUrl(url) {
  try {
    const u = new URL(url)
    return (u.hostname.replace(/^www\./, "") + u.pathname).replace(/\/$/, "")
  } catch {
    return url ?? ""
  }
}

function HomeStory({ contents }) {
  // 예시 자료: 최근 자료 중 이미 쓰던 태그를 하나 이상 가진 것 (그래프에 이어지는 모습이 보이게)
  const story = useMemo(() => {
    const sorted = [...contents].sort(byNewest)
    const tagsOf = (c) => lower(c.tags)
    const pick =
      sorted.find((c) => {
        const mine = tagsOf(c)
        if (mine.length < 2) return false
        return contents.some((o) => o !== c && tagsOf(o).some((t) => mine.includes(t)))
      }) ?? sorted[0]
    if (!pick) return null
    const others = contents.filter((c) => c !== pick)
    const known = new Set(others.flatMap(tagsOf))
    const mine = tagsOf(pick)
    const items = (list) => list.map((c) => ({ cat: c.category, tags: c.tags ?? [] }))
    const linked = others.filter((o) => tagsOf(o).some((t) => mine.includes(t))).length
    // 찾기 단계에서 고를 태그: 이미 쓰던 태그 중 첫 번째
    const focus = mine.find((t) => known.has(t)) ?? mine[0]
    const focusLabel = (pick.tags ?? [])[mine.indexOf(focus)] ?? focus
    return {
      item: pick,
      known,
      linked,
      focus,
      question: `지난번에 저장한 ${focusLabel} 자료 찾아줘`,
      before: topTags(tagGraph(items(others)), STORY_MAX_TAGS, mine),
      after: topTags(tagGraph(items(contents)), STORY_MAX_TAGS, mine),
      mine,
    }
  }, [contents])

  const trackRef = useRef(null)
  const stageRef = useRef(null)
  const pin = usePinProgress(trackRef, stageRef, STORY_SCREENS)

  // 진행도를 단계로 나눈다. 고정을 안 쓰면 마지막 단계의 끝 모습
  const stepF = pin.on ? pin.p * STEPS.length : STEPS.length
  const active = Math.min(STEPS.length - 1, Math.floor(stepF))
  const local = pin.on ? Math.min(1, stepF - active) : 1
  // 단계 안에서 앞 70% 동안 글자를 친다
  const typedRatio = Math.min(1, local / 0.7)
  const typed = (text, step) => (active > step ? text : active < step ? "" : text.slice(0, Math.ceil(typedRatio * text.length)))

  const saved = active >= 3

  // 그래프: 저장 전에는 예시 자료가 없는 그래프, 저장하면 예시 자료의 태그가 자라난다
  const canvasRef = useRef(null)
  const graphRef = useRef(null)
  const grownRef = useRef(false)
  useEffect(() => {
    if (!canvasRef.current || !story) return
    if (!graphRef.current) {
      graphRef.current = create(canvasRef.current, {
        data: saved ? story.after : story.before,
        scale: 0.42,
        cx: 0.62,
        labels: "big",
        labelMin: 2,
        dust: 40,
        seed: 21,
        speed: 0.05,
      })
      grownRef.current = saved
      return
    }
    if (saved && !grownRef.current) graphRef.current.grow(story.after)
    if (!saved && grownRef.current) graphRef.current.setData(story.before, true)
    grownRef.current = saved
  }, [story, saved])
  useEffect(
    () => () => {
      graphRef.current?.destroy()
      graphRef.current = null
    },
    []
  )
  useEffect(() => {
    const g = graphRef.current
    if (!g || !story) return
    g.setHighlight(saved ? new Set(story.mine) : null)
    if (active === 4 && local > 0.6) {
      g.select(story.focus)
      g.view({ focus: story.focus, zoom: 1.6 })
    } else {
      g.select(null)
      g.view({ focus: null, zoom: 1 })
    }
  }, [story, saved, active, local])

  if (!story) return null
  const it = story.item
  const tags = it.tags ?? []
  // 태그 칩은 세 번째 단계에서 하나씩 나타난다
  const shownTags = active > 2 ? tags.length : active < 2 ? 0 : Math.ceil(typedRatio * tags.length)
  const found = active === 4 && local > 0.6

  return (
    <section
      ref={trackRef}
      className={pin.on ? `${styles.sec} ${styles.pinned}` : styles.sec}
      aria-labelledby="story-title"
    >
      <div ref={stageRef} className={styles.stage}>
        <div className={styles.intro}>
          <h2 className={styles.h2} id="story-title">
            링크 하나가 지식이 되기까지
          </h2>
          <ol className={styles.steps} style={{ "--p": pin.on ? pin.p : 1 }}>
            {STEPS.map((st, i) => (
              <li key={st.title} className={!pin.on || i === active ? styles.on : undefined}>
                {pin.on ? (
                  <button type="button" onClick={() => pin.seek((i + 0.75) / STEPS.length)}>
                    <span className={styles.num}>{i + 1}</span>
                    <b>{st.title}</b>
                  </button>
                ) : (
                  <div className={styles.head}>
                    <span className={styles.num}>{i + 1}</span>
                    <b>{st.title}</b>
                  </div>
                )}
                <p>{st.desc}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.view} aria-hidden="true">
          <canvas ref={canvasRef} className={`${styles.canvas} ${saved ? styles.lit : ""}`} />

          <div className={`${styles.card} ${saved ? styles.aside : ""} ${found ? styles.found : ""}`}>
            <div className={styles.url}>
              <span className={styles.dot} />
              {typed(shortUrl(it.url), 0) || <span className={styles.ph}>링크를 붙여 넣으세요</span>}
            </div>
            {active >= 1 && (
              <>
                <b className={styles.title}>{typed(it.title ?? "", 1)}</b>
                {!saved && <p className={styles.sum}>{typed(it.summary ?? "", 1)}</p>}
              </>
            )}
            {active >= 2 && (
              <div className={styles.meta}>
                <span className={styles.cat}>
                  <i style={{ background: categoryColor(it.category) }} />
                  {it.category}
                </span>
                {tags.slice(0, shownTags).map((t) => {
                  const reused = story.known.has(String(t).toLowerCase())
                  return (
                    <span key={t} className={reused ? styles.tag : `${styles.tag} ${styles.new}`}>
                      #{t}
                      <small>{reused ? "기존" : "새 태그"}</small>
                    </span>
                  )
                })}
              </div>
            )}
            {saved && (
              <p className={styles.status}>
                {found ? "찾았습니다" : `저장됨 · 같은 태그를 가진 자료 ${story.linked}건과 이어짐`}
              </p>
            )}
          </div>

          <div className={`${styles.ask} ${active === 4 ? styles.askOn : ""}`}>
            <span>{typed(story.question, 4) || " "}</span>
            <em>AI로 찾기</em>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HomeStory
