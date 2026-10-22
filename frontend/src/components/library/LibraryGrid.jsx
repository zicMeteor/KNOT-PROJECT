// 전체 자료 카드 목록
// 카드에 마우스를 올리거나 키보드로 초점을 옮기면, 같은 태그를 가진 카드로 빛나는 실이 이어진다
// 실은 카드 뒤에 그린다. 카드가 불투명해서 카드 사이 틈으로만 보이고 글자를 가리지 않는다
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { categoryColor } from "../../constants/categories"
import { dayOf, hostOf, isUnanalyzed, kindOf, sharedTags, shortDay, tagName } from "../../lib/contentMeta"
import { reducedMotion } from "../../lib/threadGraph"
import { searchWords } from "../../hooks/useLibraryFilter"
import styles from "./LibraryGrid.module.css"

// 아무도 건드리지 않을 때 카드를 차례로 짚어 실을 보여 주는 간격 (ms)
const DEMO_MS = 2800

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// 제목에서 검색어와 같은 부분을 <mark>로 감싼다
function Highlight({ text, words }) {
  if (words.length === 0) return text
  const re = new RegExp(`(${words.map(escapeRegExp).join("|")})`, "gi")
  return String(text)
    .split(re)
    .map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part))
}

// items: 보여 줄 자료 / query: 검색어 (제목 강조용) / threads: 실 표시 여부 / onOpen(id): 카드를 눌렀을 때
function LibraryGrid({ items, query, threads, paused, onOpen }) {
  const wrapRef = useRef(null)
  const svgRef = useRef(null)
  const cardRefs = useRef(new Map())
  const [hotId, setHotId] = useState(null)
  const [touched, setTouched] = useState(false) // 사용자가 카드를 건드렸으면 시연을 멈춘다

  // 제목 강조도 목록 검색과 같은 단어로 (앞의 #은 뗀다)
  // 두 글자 이상 단어가 있으면 한 글자 단어는 강조하지 않는다 (제목 곳곳의 글자에 표시가 붙지 않게)
  const words = useMemo(() => {
    const all = searchWords(query)
    return all.some((w) => w.length >= 2) ? all.filter((w) => w.length >= 2) : all
  }, [query])
  const ids = items.map((c) => c.id).join(",")

  // 목록이 바뀌면 카드가 차례로 들어온다 (처음 그릴 때는 연출 없이 바로 보인다)
  // 목록이 바뀐 것을 렌더링 중에 알아채고 상태를 맞춘다 (effect로 하면 한 번 더 그린다)
  const [prevIds, setPrevIds] = useState(ids)
  const [enterKey, setEnterKey] = useState(0)
  if (prevIds !== ids) {
    setPrevIds(ids)
    setEnterKey((k) => k + 1)
    setHotId(null)
  }
  const animate = enterKey > 0

  const hot = threads ? items.find((c) => c.id === hotId) : null

  // 실로 이어질 카드: id → 함께 가진 태그
  const relatedMap = useMemo(() => {
    const map = new Map()
    if (!hot) return map
    for (const c of items) {
      if (c.id === hot.id) continue
      const shared = sharedTags(c, hot)
      if (shared.length > 0) map.set(c.id, shared)
    }
    return map
  }, [hot, items])

  // 실 그리기: 카드 위치를 재야 하므로 화면에 그린 뒤 SVG를 직접 고친다
  useLayoutEffect(() => {
    const svg = svgRef.current
    const wrap = wrapRef.current
    if (!svg || !wrap) return
    function draw() {
      svg.replaceChildren()
      if (!hot) return
      const from = cardRefs.current.get(hot.id)
      if (!from) return
      const box = wrap.getBoundingClientRect()
      const a = from.getBoundingClientRect()
      const ax = (a.left + a.right) / 2 - box.left
      const ay = (a.top + a.bottom) / 2 - box.top
      const reduced = reducedMotion()
      let i = 0
      for (const [id, shared] of relatedMap) {
        const el = cardRefs.current.get(id)
        const item = items.find((c) => c.id === id)
        if (!el || !item) continue
        const r = el.getBoundingClientRect()
        const bx = (r.left + r.right) / 2 - box.left
        const by = (r.top + r.bottom) / 2 - box.top
        const mx = (ax + bx) / 2 + (by - ay) * 0.15
        const my = (ay + by) / 2 - (bx - ax) * 0.15
        const len = Math.hypot(bx - ax, by - ay) * 1.4 + 80
        const color = categoryColor(item.category)
        const p = document.createElementNS("http://www.w3.org/2000/svg", "path")
        p.setAttribute("d", `M${ax.toFixed(1)} ${ay.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`)
        p.style.color = color
        p.style.stroke = color
        p.style.strokeWidth = String(1 + shared.length * 0.7)
        p.style.strokeDasharray = String(len)
        p.style.strokeDashoffset = reduced ? "0" : String(len)
        p.style.transitionDelay = `${i * 50}ms`
        svg.appendChild(p)
        i++
      }
      if (!reduced) {
        requestAnimationFrame(() => {
          for (const p of svg.querySelectorAll("path")) p.style.strokeDashoffset = "0"
        })
      }
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [hot, relatedMap, items])

  // 시연: 실이 이어지는 카드를 차례로 짚는다. 마우스를 올리거나 초점을 옮기면 멈춘다
  const demoIds = useMemo(
    () => items.filter((c) => items.some((o) => o.id !== c.id && sharedTags(c, o).length > 0)).slice(0, 6).map((c) => c.id),
    [items]
  )
  useEffect(() => {
    if (touched || paused || !threads || demoIds.length === 0 || reducedMotion()) return
    let i = 0
    const id = setInterval(() => {
      setHotId(demoIds[i % demoIds.length])
      i++
    }, DEMO_MS)
    return () => clearInterval(id)
  }, [touched, paused, threads, demoIds])

  function touch(id) {
    setTouched(true)
    setHotId(id)
  }

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      onMouseLeave={() => touched && setHotId(null)}
    >
      <svg ref={svgRef} className={styles.threads} aria-hidden="true" />
      <ul key={enterKey} className={styles.grid}>
        {items.map((c, i) => {
          const kind = kindOf(c.url)
          const color = categoryColor(c.category)
          const shared = relatedMap.get(c.id)
          const cls = [
            styles.card,
            styles[kind.key],
            animate && styles.enter,
            hot?.id === c.id && styles.hot,
            shared && styles.rel,
          ]
            .filter(Boolean)
            .join(" ")
          return (
            <li key={c.id} className={styles.cell}>
              <button
                ref={(el) => {
                  if (el) cardRefs.current.set(c.id, el)
                  else cardRefs.current.delete(c.id)
                }}
                type="button"
                className={cls}
                style={{ "--cat": color, animationDelay: `${Math.min(i * 45, 500)}ms` }}
                onMouseEnter={() => touch(c.id)}
                onFocus={() => touch(c.id)}
                onClick={() => onOpen(c.id)}
              >
                <span className={styles.edge} aria-hidden="true" />
                {/* 카테고리(분류)와 종류(주소로 짐작)는 다른 기준이라 나눠 보인다 */}
                <span className={styles.kind}>
                  <span className={styles.cat}>
                    <i style={{ background: color }} aria-hidden="true" />
                    {c.category ?? "기타"}
                  </span>
                  <span>{kind.label}</span>
                  {isUnanalyzed(c) && <span className={styles.badge}>AI 분석 안 됨</span>}
                </span>
                {shared && <span className={styles.common}>공통 태그: {shared.join(", ")}</span>}
                <b className={styles.title}>
                  <Highlight text={c.title || hostOf(c.url)} words={words} />
                </b>
                {/* AI 요약이 없는 자료(메모로만 저장)는 메모가 그 자료를 설명한다 */}
                {c.summary ? (
                  <span className={styles.summary}>{c.summary}</span>
                ) : (
                  c.memo && <span className={styles.summary}>메모: {c.memo}</span>
                )}
                {c.tags?.length > 0 && (
                  <span className={styles.tags}>
                    {c.tags.map((t) => (
                      <span key={tagName(t)}>{tagName(t)}</span>
                    ))}
                  </span>
                )}
                <span className={styles.meta}>
                  <span>{hostOf(c.url)}</span>
                  <span>{shortDay(dayOf(c.createdAt))}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default LibraryGrid
