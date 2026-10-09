// 자료 추가 오른쪽: 새 자료가 지식 그래프의 어디에 묶일지 미리 보여 준다
// 분석 중에는 실이 떨리고, 결과가 나오면 새 자료의 태그 쪽으로 확대되며 태그 칩이 제자리로 날아간다
import { useEffect, useMemo, useRef } from "react"
import { create, reducedMotion, tagGraph } from "../../lib/threadGraph"
import { sharedTags } from "../../lib/contentMeta"
import styles from "./AddStage.module.css"

// 결과가 나온 뒤 칩이 날아가기 시작할 때까지 (요약이 써지는 동안 기다린다)
const FLY_DELAY = 1300

function toItems(list) {
  return list.map((c) => ({ cat: c.category, tags: c.tags ?? [] }))
}

// phase: idle | busy | result | saved
// contents: 저장된 자료 / analysis: 분석 결과 (result, saved일 때) / chipsRef: 날아갈 태그 칩이 든 요소
function AddStage({ phase, contents, analysis, chipsRef }) {
  const canvasRef = useRef(null)
  const graphRef = useRef(null)

  const base = useMemo(() => tagGraph(toItems(contents)), [contents])
  const tags = useMemo(() => (analysis?.tags ?? []).map((t) => t.name), [analysis])
  const ids = useMemo(() => tags.map((t) => t.toLowerCase()), [tags])
  // 분석 결과를 더한 그래프 (저장 전 미리보기)
  const withNew = useMemo(
    () =>
      analysis && phase === "result"
        ? tagGraph(toItems([...contents, { category: analysis.category, tags }]))
        : base,
    [analysis, phase, contents, tags, base]
  )

  // 저장하면 이어질 자료 (함께 가진 태그가 많은 순)
  const related = useMemo(() => {
    if (!analysis) return []
    const me = { tags }
    // 저장한 뒤에는 목록에 자기 자신도 들어 있으므로 뺀다
    const isSelf = (c) => (analysis.url ? c.url === analysis.url : c.title === analysis.title)
    return contents
      .filter((c) => !isSelf(c))
      .map((c) => ({ c, n: sharedTags(c, me).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .map((x) => x.c)
  }, [analysis, contents, tags])

  useEffect(() => {
    if (!canvasRef.current) return
    graphRef.current = create(canvasRef.current, {
      data: { nodes: [], links: [] },
      scale: 0.36,
      cy: 0.4,
      labels: "big",
      labelMin: 2,
      dust: 60,
      seed: 4,
      speed: 0.07,
    })
    return () => {
      graphRef.current?.destroy()
      graphRef.current = null
    }
  }, [])

  // 단계마다 그래프를 바꾼다
  useEffect(() => {
    const g = graphRef.current
    if (!g) return
    let tremble = 0
    let fly = 0
    const ghosts = []
    if (phase === "busy") {
      g.setHighlight(null)
      g.pluckAll(10)
      tremble = setInterval(() => g.pluckAll(6), 900)
    } else if (phase === "result") {
      g.grow(withNew)
      g.pluckAll(22)
      g.setHighlight(new Set(ids))
      // 이미 있던 태그 쪽으로 확대한다. 모두 새 태그면 첫 태그로
      const known = new Set(base.nodes.map((n) => n.id))
      g.view({ focus: ids.find((id) => known.has(id)) ?? ids[0] ?? null, zoom: 2.1 })
      fly = setTimeout(() => flyChips(g, canvasRef.current, chipsRef?.current, ghosts), FLY_DELAY)
    } else if (phase === "saved") {
      g.setData(base, true)
      g.setHighlight(new Set(ids))
      g.view({ focus: ids[0] ?? null, zoom: 1.6 })
      g.pluckAll(30)
    } else {
      g.setData(base, true)
      g.setHighlight(null)
      g.view({ focus: null, zoom: 1 })
    }
    return () => {
      clearInterval(tremble)
      clearTimeout(fly)
      for (const el of ghosts) el.remove()
    }
  }, [phase, base, withNew, ids, chipsRef])

  let title
  let body
  if (phase === "result" && analysis) {
    const known = new Set(base.nodes.map((n) => n.id))
    const fresh = tags.filter((t) => !known.has(t.toLowerCase()))
    title = `기존 태그 ${tags.length - fresh.length}개, 새 태그 ${fresh.length}개`
    body =
      (related.length > 0
        ? `저장하면 이어질 자료: ${related.slice(0, 2).map((c) => c.title).join(", ")}${related.length > 2 ? ` 외 ${related.length - 2}건` : ""}.`
        : "아직 같은 태그를 가진 자료가 없습니다. 저장하면 새 무리가 생깁니다.") +
      (fresh.length > 0 ? ` 새로 생기는 태그: ${fresh.join(", ")}.` : "")
  } else if (phase === "saved") {
    title = "묶였습니다"
    body =
      related.length > 0
        ? `${related.slice(0, 2).map((c) => c.title).join(", ")}와 같은 실에 놓였습니다.`
        : "새 태그로 그래프에 자리를 잡았습니다."
  } else if (phase === "busy") {
    title = "읽는 중"
    body = "본문을 가져와 요약하고 있습니다. 보통 몇 초 걸립니다."
  } else {
    title = "어디에 묶일지 여기서 보입니다"
    body =
      base.nodes.length > 0
        ? `지금 그래프에는 태그 ${base.nodes.length}개가 이어져 있습니다. 분석이 끝나면 새 자료의 태그가 이 안에서 빛납니다.`
        : "아직 저장한 자료가 없습니다. 첫 자료를 넣으면 여기에 첫 태그가 생깁니다."
  }

  return (
    <div className={styles.stage} aria-label="이 자료가 묶일 자리">
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <span className={styles.tag}>{phase === "idle" ? "지금의 지식 그래프" : "새 자료가 들어갈 자리"}</span>
      <div className={styles.cap} aria-live="polite">
        <b>{title}</b>
        <span>{body}</span>
      </div>
    </div>
  )
}

// 태그 칩이 그래프 속 제자리로 날아가고, 도착한 점이 반짝인다
function flyChips(g, canvas, chipsBox, ghosts) {
  if (!canvas || !chipsBox) return
  const reduced = reducedMotion()
  const cr = canvas.getBoundingClientRect()
  chipsBox.querySelectorAll("[data-tag]").forEach((chip, i) => {
    const id = chip.getAttribute("data-tag")
    const pos = g.screenPos(id)
    if (!pos) return
    if (reduced || !chip.animate) {
      g.pulse(id)
      return
    }
    const r = chip.getBoundingClientRect()
    const ghost = chip.cloneNode(true)
    ghost.removeAttribute("data-tag")
    Object.assign(ghost.style, {
      position: "fixed",
      left: `${r.left}px`,
      top: `${r.top}px`,
      margin: "0",
      zIndex: "80",
      pointerEvents: "none",
      animation: "none",
    })
    document.body.appendChild(ghost)
    ghosts.push(ghost)
    const dx = cr.left + pos.x - (r.left + r.width / 2)
    const dy = cr.top + pos.y - (r.top + r.height / 2)
    const anim = ghost.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.55}px,${dy * 0.55 - 60}px) scale(.9)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${dx}px,${dy}px) scale(.2)`, opacity: 0 },
      ],
      { duration: 900, delay: i * 140, easing: "cubic-bezier(.5,0,.2,1)", fill: "both" }
    )
    anim.onfinish = () => {
      ghost.remove()
      g.pulse(id)
      g.pluckAll(8)
    }
  })
}

export default AddStage
