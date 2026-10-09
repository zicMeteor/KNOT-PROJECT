import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import ForceGraph3D from "react-force-graph-3d"
import SpriteText from "three-spritetext"
import { categoryColor } from "../constants/categories"
import styles from "./KnowledgeGraph.module.css"

const LABEL_COLOR = "#d4d4d8"
const LABEL_STRONG = "#fafafa" // 찾은 노드·선택한 노드 글자 (라임 공 위에 라임 글자는 안 읽혀서 흰색)
const NODE_DIM = "#3f3f46" // 강조 중일 때 관련 없는 노드
const LINK_BASE = "#52525b" // 평소 실
const LINK_DIM = "#27272a" // 강조 중일 때 관련 없는 실
const LINK_LIT = "#e4e4e7" // 강조된 실과 입자

// AI 검색으로 찾은 노드 전용 색. 카테고리 팔레트 어느 색과도 겹치지 않고 훨씬 밝다
const HIT_COLOR = "#a3e635"
const HIT_DIM = "#3f5a14" // 다른 강조 중에도 찾은 노드인 건 알아보게 어두운 라임

// 노드 반지름은 val의 세제곱근에 비례한다
const HIT_VAL_SCALE = 3 // 찾은 노드 → 약 1.44배
const SELECTED_VAL_SCALE = 4 // 선택한 노드 → 약 1.59배 (찾은 노드보다 크게 해서 무엇을 골랐는지 보이게)

const NODE_REL_SIZE = 3 // 반지름 = val의 세제곱근 × 이 값 (ForceGraph3D nodeRelSize와 같아야 함)
const LABEL_GAP = 7 // 공 아래쪽 끝과 글자 중심 사이 거리

// 전체(카테고리 6개, 고정)와 카테고리(태그, 계속 늘어남)는 반발 거리를 따로 둔다
const CHARGE_RANGE = { all: 60, category: 90 }

// 태그 노드를 눌렀을 때 카메라가 노드에서 떨어지는 거리
const FOCUS_DISTANCE = 100

// 검색 결과로 카메라를 옮길 때
const HIT_CAMERA_MS = 800 // 카메라 이동 시간(ms)
const HIT_FIT_MARGIN = 1.15 // 찾은 노드 묶음 둘레에 남길 여유 (1보다 크면 멀어짐. 검색창에 가리면 키운다)
const MIN_HIT_DISTANCE = 140 // 묶음 중심에서 카메라까지 최소 거리 (노드가 1~2개일 때 너무 붙지 않게)

// 검색 연출: 카메라 이동이 끝난 뒤 찾은 노드가 결과 순서대로 하나씩 켜진다
// 카메라가 움직이는 동안 화면을 다시 그리면 끊겨 보여서, 이동이 끝난 다음에 시작한다
const REVEAL_DELAY = HIT_CAMERA_MS + 50 // 첫 노드가 켜질 때까지(ms)
const REVEAL_STEP = 120 // 켜지는 간격(ms)
// 찾은 노드가 많아도 화면을 다시 그리는 횟수는 이만큼만 (넘으면 여러 개씩 묶어서 켠다)
const MAX_REVEAL_STEPS = 8

// 기기에서 "동작 줄이기"를 켜 두었으면 연출 없이 한 번에 보여준다 (카메라도 바로 이동)
function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}

// 움직임 시간: 동작 줄이기면 0 (애니메이션 없이 바로)
function motionMs(ms) {
  return prefersReducedMotion() ? 0 : ms
}

// 노드가 적으면 여백을 크게 줘서 과하게 확대되지 않게 한다
function fitPadding(nodeCount) {
  return nodeCount < 8 ? 120 : 40
}

// 글자 위치: 공 반지름만큼 내려서 공과 겹치지 않게 한다
function labelY(baseRadius, valScale) {
  return -(baseRadius * Math.cbrt(valScale) + LABEL_GAP)
}

// 카메라가 노드 쪽으로 다가간다 (공식 click-to-focus 예제 방식)
function focusCamera(fg, node, ms) {
  const len = Math.hypot(node.x, node.y, node.z) || 1
  const ratio = 1 + FOCUS_DISTANCE / len
  fg.cameraPosition({ x: node.x * ratio, y: node.y * ratio, z: node.z * ratio }, node, ms)
}

// 검색 결과로 카메라를 옮긴다
// - 화면 중심: centerIds(질문 태그, 없으면 찾은 노드 전체)의 가운데
// - 거리: coverIds(찾은 노드 전체)가 모두 화면에 들어오도록. 단 MIN_HIT_DISTANCE보다 가까이 가지 않는다
// - 지금 보는 방향은 그대로 둔다
// 카메라를 실제로 옮겼으면 true (그래프가 아직 없거나 위치가 정해지지 않았으면 false)
function fitToHits(fg, centerIds, coverIds, nodes, ms) {
  if (!fg || !centerIds || centerIds.size === 0) return false
  const placed = (n) => Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z)
  const centers = nodes.filter((n) => centerIds.has(n.id) && placed(n))
  if (centers.length === 0) return false
  const covers = nodes.filter((n) => coverIds.has(n.id) && placed(n))

  const c = { x: 0, y: 0, z: 0 }
  for (const n of centers) {
    c.x += n.x / centers.length
    c.y += n.y / centers.length
    c.z += n.z / centers.length
  }
  // 중심에서 가장 먼 찾은 노드까지 (+ 노드 크기와 글자 여유)
  let r = 0
  for (const n of [...centers, ...covers]) r = Math.max(r, Math.hypot(n.x - c.x, n.y - c.y, n.z - c.z))
  r += 12

  // 세로·가로 시야 중 좁은 쪽에 다 들어오는 거리
  const cam = fg.camera()
  const vHalf = (cam.fov * Math.PI) / 360
  const hHalf = Math.atan(Math.tan(vHalf) * cam.aspect)
  const dist = Math.max(MIN_HIT_DISTANCE, (r / Math.sin(Math.min(vHalf, hHalf))) * HIT_FIT_MARGIN)

  // 지금 카메라가 있는 방향 그대로, 중심에서 dist만큼 떨어진 곳으로
  let dx = cam.position.x - c.x
  let dy = cam.position.y - c.y
  let dz = cam.position.z - c.z
  let len = Math.hypot(dx, dy, dz)
  if (len < 1e-6) {
    dx = 0
    dy = 0
    dz = 1
    len = 1
  }
  fg.cameraPosition(
    { x: c.x + (dx / len) * dist, y: c.y + (dy / len) * dist, z: c.z + (dz / len) * dist },
    c,
    ms
  )
  return true
}

// 시뮬레이션이 시작되면 link.source/target이 id에서 노드 객체로 바뀐다
function endId(end) {
  return typeof end === "object" ? end.id : end
}

// data: { nodes, links } / category: 화면에 보이는 데이터의 카테고리, null이면 전체 그래프
// fitKey: 값이 바뀌면 전체가 보이게 다시 맞춘다 (사이드바를 닫을 때)
// highlightNames: 찾은 노드 이름(소문자) Set. AI 검색 결과에서 온다. 없으면 null
// focusNames: 찾은 노드 중 카메라가 중심으로 잡을 이름(소문자) Set. 질문에서 AI가 뽑은 태그. 없으면 null
// selectedName: 선택한 태그 이름. 그 노드와 이웃을 계속 밝게 보여준다. 없으면 null
// onBackgroundClick: 빈 공간을 눌렀을 때 (선택 해제용)
function KnowledgeGraph({
  data,
  category,
  onNodeClick,
  onBackgroundClick,
  fitKey = 0,
  highlightNames = null,
  focusNames = null,
  selectedName = null,
}) {
  const boxRef = useRef(null)
  const fgRef = useRef(null)
  const fittedRef = useRef(false) // 데이터마다 화면 맞춤은 한 번만
  const draggingRef = useRef(false) // 드래그 중에는 마우스 강조가 다른 노드로 바뀌지 않게
  const labelsRef = useRef(new Map()) // 노드 id → 글자 객체 (흐리게 만들 때 사용)
  const hadHitsRef = useRef(false) // 직전에 검색 결과가 있었는지 (검색을 지울 때 전체로 돌아가기용)
  const revealTimerRef = useRef(null) // 하나씩 켜지는 연출의 타이머 (돌고 있지 않으면 null)
  const latestRef = useRef({}) // 타이머·effect 안에서 쓸 최신 값 (렌더마다 갱신)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hoverId, setHoverId] = useState(null)
  // 하나씩 켜지는 연출 상태: key는 어떤 검색 결과에 대한 것인지, count는 지금까지 켜진 개수
  const [reveal, setReveal] = useState({ key: null, count: 0 })

  const nodeCount = data?.nodes.length ?? 0

  // 사이드바를 열고 닫아 캔버스 크기가 바뀌면 그래프 크기도 따라간다 (배율은 유지)
  useEffect(() => {
    const el = boxRef.current
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 새 데이터를 받으면 화면 맞춤과 강조를 초기화
  // (아래 검색 카메라 effect보다 먼저 선언되어야 fittedRef가 먼저 false가 된다)
  // 연출 타이머는 여기서 멈추지 않는다. 검색 결과가 바뀌면 아래 effect의 정리 함수가 멈추고,
  // 결과가 같으면(재분류로 그래프만 다시 불러온 경우) 이어서 켜는 게 맞다
  useEffect(() => {
    fittedRef.current = false
    draggingRef.current = false
    setHoverId(null)
  }, [data])

  // 연결 없는 노드가 멀리 밀려나지 않게 반발력이 미치는 거리를 제한한다
  useEffect(() => {
    const fg = fgRef.current
    if (!fg || !data) return
    fg.d3Force("charge")?.distanceMax(category ? CHARGE_RANGE.category : CHARGE_RANGE.all)
    fg.d3ReheatSimulation()
  }, [data, category])

  // fitKey가 바뀌면 (사이드바를 닫을 때) 전체가 보이게 다시 맞춘다
  // 캔버스 크기가 먼저 바뀌도록 조금 늦게 실행한다
  // nodeCount를 의존성에서 일부러 뺐다. 넣으면 데이터가 바뀔 때마다 실행되어 onEngineStop과 겹친다
  useEffect(() => {
    if (fitKey === 0) return
    const id = setTimeout(() => {
      fgRef.current?.zoomToFit(motionMs(600), fitPadding(nodeCount))
    }, 100)
    return () => clearTimeout(id)
  }, [fitKey])

  // 노드 id → 이웃 노드 id 집합
  const neighbors = useMemo(() => {
    const map = new Map()
    for (const l of data?.links ?? []) {
      const a = endId(l.source)
      const b = endId(l.target)
      if (!map.has(a)) map.set(a, new Set())
      if (!map.has(b)) map.set(b, new Set())
      map.get(a).add(b)
      map.get(b).add(a)
    }
    return map
  }, [data])

  // 노드 이름(소문자) → id. 이름으로 노드를 찾는 곳은 모두 이것을 쓴다
  const idByName = useMemo(
    () => new Map((data?.nodes ?? []).map((n) => [String(n.name).toLowerCase(), n.id])),
    [data]
  )

  // 선택한 태그 이름 → 지금 그래프의 노드 id. 카테고리 그래프에서만 의미가 있다
  const selectedId = useMemo(() => {
    if (!selectedName || !category) return null
    return idByName.get(String(selectedName).toLowerCase()) ?? null
  }, [selectedName, category, idByName])

  // 검색 강조: 이름이 맞는 노드 id 집합. 지금 그래프에 맞는 노드가 하나도 없으면 강조하지 않는다
  // (모든 노드가 흐려져 고장 난 것처럼 보이는 것을 막는다)
  const highlightIds = useMemo(() => {
    if (!highlightNames || highlightNames.size === 0) return null
    const ids = new Set()
    for (const name of highlightNames) {
      const id = idByName.get(name)
      if (id != null) ids.add(id)
    }
    return ids.size > 0 ? ids : null
  }, [highlightNames, idByName])

  // 카메라가 중심으로 잡을 노드: 찾은 노드 중 질문에서 뽑은 태그와 이름이 같은 것
  // (예: "트랜스포머" → Transformer). 하나도 없으면 null → 찾은 노드 전체의 가운데
  const focusIds = useMemo(() => {
    if (!highlightIds || !focusNames || focusNames.size === 0) return null
    const ids = new Set()
    for (const name of focusNames) {
      const id = idByName.get(name)
      if (id != null && highlightIds.has(id)) ids.add(id)
    }
    return ids.size > 0 ? ids : null
  }, [highlightIds, focusNames, idByName])

  // 찾은 노드를 켤 순서: 질문 태그(카메라 중심)가 먼저, 그다음 검색 결과 순서
  const hitOrder = useMemo(() => {
    if (!highlightIds) return []
    const order = []
    const seen = new Set()
    for (const name of [...(focusNames ?? []), ...highlightNames]) {
      const id = idByName.get(name)
      if (id == null || !highlightIds.has(id) || seen.has(id)) continue
      seen.add(id)
      order.push(id)
    }
    return order
  }, [highlightIds, highlightNames, focusNames, idByName])

  // 검색 결과를 나타내는 값. 내용이 같으면 같은 값이라, 재분류 등으로 그래프만 다시 불러와도
  // 연출을 처음부터 다시 하지 않는다 (Set 객체가 새로 만들어져도 내용으로 비교)
  const hitKey = highlightIds ? `${category ?? ""}|${hitOrder.join(",")}` : null

  // 지금까지 켜진 찾은 노드. 새 검색 결과로 바뀐 직후에는 연출이 시작되기 전이라 비어 있다
  const revealedIds = useMemo(() => {
    if (!highlightIds) return null
    if (reveal.key !== hitKey) return new Set()
    return new Set(hitOrder.slice(0, reveal.count))
  }, [highlightIds, hitKey, hitOrder, reveal])

  const isHit = useCallback((id) => revealedIds?.has(id) ?? false, [revealedIds])

  // 하나씩 켜지는 중인지 (켜지는 동안에는 검색 실의 입자를 끈다)
  const revealing = revealedIds != null && revealedIds.size < hitOrder.length

  // 타이머·effect 안에서 읽을 최신 값
  useLayoutEffect(() => {
    latestRef.current = { data, nodeCount, highlightIds, focusIds, hitOrder, hitKey, revealKey: reveal.key }
  })

  // 연출 시작: REVEAL_DELAY 뒤부터 REVEAL_STEP 간격으로 켠다
  // 찾은 노드가 MAX_REVEAL_STEPS보다 많으면 한 번에 여러 개씩 켠다 (다시 그리는 횟수를 줄이려고)
  const startReveal = useCallback((key, total) => {
    clearTimeout(revealTimerRef.current)
    revealTimerRef.current = null
    if (prefersReducedMotion() || total <= 0) {
      setReveal({ key, count: Infinity })
      return
    }
    setReveal({ key, count: 0 })
    const perStep = Math.ceil(total / Math.min(total, MAX_REVEAL_STEPS))
    let n = 0
    const step = () => {
      n = Math.min(total, n + perStep)
      setReveal({ key, count: n })
      revealTimerRef.current = n < total ? setTimeout(step, REVEAL_STEP) : null
    }
    revealTimerRef.current = setTimeout(step, REVEAL_DELAY)
  }, [])

  // 검색 결과 쪽으로 카메라를 옮기고 연출을 시작한다
  // - 같은 결과를 이미 보여줬으면(그래프만 다시 불러온 경우) 카메라만 옮기고 연출은 다시 하지 않는다
  // - 카메라를 못 옮겼으면(위치가 아직 없음) 어두운 채로 기다리지 않게 바로 모두 켠다
  const showHits = useCallback(() => {
    const v = latestRef.current
    if (!v.highlightIds) return
    const moved = fitToHits(
      fgRef.current,
      v.focusIds ?? v.highlightIds,
      v.highlightIds,
      v.data?.nodes ?? [],
      motionMs(HIT_CAMERA_MS)
    )
    if (v.revealKey === v.hitKey) return
    if (moved) startReveal(v.hitKey, v.hitOrder.length)
    else setReveal({ key: v.hitKey, count: Infinity })
  }, [startReveal])

  // 화면을 떠나면 남은 타이머를 정리한다
  useEffect(() => () => clearTimeout(revealTimerRef.current), [])

  // 그래프가 처음 자리 잡으면 화면을 맞춘다. 검색 결과가 있으면 찾은 노드 쪽으로, 없으면 전체
  // (검색 후 다른 카테고리로 자동 이동한 경우가 여기에 해당한다)
  function handleEngineStop() {
    if (fittedRef.current) return
    fittedRef.current = true
    if (highlightIds) showHits()
    else fgRef.current?.zoomToFit(motionMs(400), fitPadding(nodeCount))
  }

  // 같은 그래프에서 검색 결과가 바뀌면 찾은 노드 쪽으로 다가가며 하나씩 켜고,
  // 검색을 지우면 전체가 보이게 카메라를 옮긴다
  // 그래프가 아직 자리 잡는 중이면(fittedRef가 false) handleEngineStop이 대신 한다
  // 오른쪽 사이드바가 열리며 캔버스 크기가 바뀌므로 조금 늦게 실행한다
  // 결과가 바뀌거나 사라지면(정리 함수) 이전 결과의 연출 타이머도 멈춘다
  useEffect(() => {
    const hadHits = hadHitsRef.current
    hadHitsRef.current = hitKey != null
    if (!fittedRef.current) return
    if (hitKey == null && !hadHits) return
    const id = setTimeout(() => {
      if (latestRef.current.hitKey != null) showHits()
      else fgRef.current?.zoomToFit(motionMs(HIT_CAMERA_MS), fitPadding(latestRef.current.nodeCount))
    }, 100)
    return () => {
      clearTimeout(id)
      clearTimeout(revealTimerRef.current)
      revealTimerRef.current = null
    }
  }, [hitKey, showHits])

  // 노드 크기 배율: 선택한 노드 > 찾은 노드 > 보통
  const valScale = useCallback(
    (id) => (id === selectedId ? SELECTED_VAL_SCALE : isHit(id) ? HIT_VAL_SCALE : 1),
    [selectedId, isHit]
  )

  // 밝기 우선순위: 마우스 올림 > 선택한 태그 > 검색 결과 > 모두 밝게
  // 마우스 올림과 선택은 "그 노드 + 이웃"을 밝게 한다
  // 검색 결과는 켜진 노드만 밝다 (연출 중에는 나머지가 어두운 채로 하나씩 켜진다)
  const focusId = hoverId ?? selectedId

  const isLit = useCallback(
    (id) => {
      if (focusId != null) return id === focusId || neighbors.get(focusId)?.has(id)
      if (revealedIds) return revealedIds.has(id)
      return true
    },
    [focusId, neighbors, revealedIds]
  )

  // 양 끝 노드가 모두 켜지면 그 실이 밝아지고 입자가 흐른다
  const isLinkLit = useCallback(
    (l) => {
      const a = endId(l.source)
      const b = endId(l.target)
      if (focusId != null) return a === focusId || b === focusId
      if (revealedIds) return revealedIds.has(a) && revealedIds.has(b)
      return false
    },
    [focusId, revealedIds]
  )

  // 입자: 밝은 실에 흐른다. 검색 연출 중에는 검색 실만 끈다 (마우스 올림·선택 실은 평소처럼)
  const particlesOn = !revealing || focusId != null

  const focusing = focusId != null || highlightIds != null

  // 색: 찾은 노드는 어떤 강조 중에도 라임 계열을 유지한다
  function nodeColorOf(node) {
    const lit = isLit(node.id)
    if (isHit(node.id)) return lit ? HIT_COLOR : HIT_DIM
    return lit ? categoryColor(category ?? node.name) : NODE_DIM
  }

  // 글자는 three.js 객체라 색 함수로 못 바꾸므로 직접 바꾼다
  // 색은 바뀔 때만 넣는다 (SpriteText는 색을 넣을 때마다 글자 그림을 다시 그린다)
  useEffect(() => {
    for (const [id, sprite] of labelsRef.current) {
      const strong = id === selectedId || isHit(id)
      const color = strong ? LABEL_STRONG : LABEL_COLOR
      if (sprite.color !== color) sprite.color = color
      sprite.position.y = labelY(sprite.userData.baseRadius, valScale(id))
      sprite.material.opacity = isLit(id) ? 1 : 0.15
    }
  }, [isLit, isHit, valScale, selectedId])

  // 의존성이 없어야 강조할 때 글자 객체가 다시 만들어지지 않는다
  const makeLabel = useCallback((node) => {
    const sprite = new SpriteText(node.name)
    sprite.color = LABEL_COLOR
    sprite.textHeight = 4
    sprite.fontFace = "Pretendard, system-ui, sans-serif"
    sprite.fontWeight = "600"
    sprite.fontSize = 120
    sprite.userData.baseRadius = Math.cbrt(node.val || 1) * NODE_REL_SIZE
    sprite.position.y = labelY(sprite.userData.baseRadius, 1)
    sprite.material.depthWrite = false
    labelsRef.current.set(node.id, sprite)
    return sprite
  }, [])

  function handleNodeHover(node) {
    if (draggingRef.current) return
    setHoverId(node ? node.id : null)
    if (boxRef.current) boxRef.current.style.cursor = node ? "pointer" : ""
  }

  // 드래그하는 동안 그 노드와 연결된 선을 밝게 보여준다
  function handleNodeDrag(node) {
    if (draggingRef.current) return
    draggingRef.current = true
    setHoverId(node.id)
  }

  function handleNodeDragEnd() {
    draggingRef.current = false
    setHoverId(null)
  }

  // 카테고리 그래프에서 태그를 누르면 카메라가 그 노드 쪽으로 다가간다
  function handleNodeClick(node) {
    const fg = fgRef.current
    if (category && fg) focusCamera(fg, node, motionMs(800))
    onNodeClick(node)
  }

  return (
    <div ref={boxRef} className={styles.canvas}>
      {nodeCount > 0 && size.w > 0 && (
        <ForceGraph3D
          graphData={data}
          ref={fgRef}
          cooldownTicks={100}
          onEngineStop={handleEngineStop}
          width={size.w}
          height={size.h}
          backgroundColor="#09090b"
          showNavInfo={false}
          nodeLabel={() => ""}
          nodeVal={(node) => (node.val || 1) * valScale(node.id)}
          nodeRelSize={NODE_REL_SIZE}
          nodeResolution={24}
          nodeOpacity={0.95}
          nodeColor={nodeColorOf}
          nodeThreeObject={makeLabel}
          nodeThreeObjectExtend={true}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          onBackgroundClick={onBackgroundClick}
          onNodeDrag={handleNodeDrag}
          onNodeDragEnd={handleNodeDragEnd}
          linkCurvature={0.12}
          linkOpacity={0.7}
          linkWidth={(l) => (isLinkLit(l) ? 1.2 : 0)}
          linkColor={(l) => (!focusing ? LINK_BASE : isLinkLit(l) ? LINK_LIT : LINK_DIM)}
          linkDirectionalParticles={(l) => (particlesOn && isLinkLit(l) ? 2 : 0)}
          linkDirectionalParticleWidth={1.6}
          linkDirectionalParticleSpeed={0.006}
          linkDirectionalParticleColor={() => LINK_LIT}
        />
      )}
    </div>
  )
}

export default KnowledgeGraph