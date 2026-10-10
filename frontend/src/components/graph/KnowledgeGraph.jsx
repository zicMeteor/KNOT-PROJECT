import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react"
import ForceGraph3D from "react-force-graph-3d"
import SpriteText from "three-spritetext"
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Group, Points, PointsMaterial, Sprite, SpriteMaterial } from "three"
import { categoryColor } from "../../constants/categories"
import styles from "./KnowledgeGraph.module.css"

const LABEL_COLOR = "#d4d4d8"
const LABEL_STRONG = "#fafafa" // 찾은 노드·선택한 노드 글자 (라임 공 위에 라임 글자는 안 읽혀서 흰색)
const NODE_DIM = "#2a2a2e" // 강조 중일 때 관련 없는 노드
const LINK_DIM = "#1c1c1f" // 강조 중일 때 관련 없는 실
const LINK_LIT = "#f2f2f0" // 강조된 실과 입자 (흰색)
// 평소 실: 카테고리 색을 이만큼 어둡게 (0이면 검정, 1이면 원래 색)
const LINK_BASE_LEVEL = 0.85

// 빛 번짐: 노드마다 카테고리 색 빛을 겹쳐 그린다 (디자인 시안 "빛의 실")
// 노드 반지름의 몇 배까지 번지는지, 평소와 흐릴 때 밝기
const GLOW_SCALE = 10
const GLOW_OPACITY = 0.85
const GLOW_DIM_OPACITY = 0.06

// 배경 먼지: 깊이감을 주는 흐린 점
const DUST_COUNT = 500
const DUST_RADIUS = 700

// AI 검색으로 찾은 노드 전용 색. 카테고리 팔레트 어느 색과도 겹치지 않고 훨씬 밝다
const HIT_COLOR = "#a3e635"
const HIT_DIM = "#3f5a14" // 다른 강조 중에도 찾은 노드인 건 알아보게 어두운 라임

// 노드 반지름은 val의 세제곱근에 비례한다
const HIT_VAL_SCALE = 3 // 찾은 노드 → 약 1.44배
const SELECTED_VAL_SCALE = 4 // 선택한 노드 → 약 1.59배 (찾은 노드보다 크게 해서 무엇을 골랐는지 보이게)

const NODE_REL_SIZE = 4 // 반지름 = val의 세제곱근 × 이 값 (ForceGraph3D nodeRelSize와 같아야 함)
const LABEL_GAP = 9 // 공 아래쪽 끝과 글자 중심 사이 거리

// 연결 없는 노드가 멀리 밀려나지 않게 반발력이 미치는 거리를 제한한다
const CHARGE_RANGE = 140

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

// "#5b8cff" → 같은 색을 level만큼 어둡게 한 "#rrggbb"
function dimHex(hex, level) {
  const h = String(hex).replace("#", "")
  const ch = (i) =>
    Math.round(parseInt(h.slice(i, i + 2), 16) * level)
      .toString(16)
      .padStart(2, "0")
  return `#${ch(0)}${ch(2)}${ch(4)}`
}

// 빛 번짐 그림: 가운데가 밝고 바깥으로 사라지는 원. 한 번만 만들어 모든 노드가 같이 쓴다
let glowTexture = null
function getGlowTexture() {
  if (glowTexture) return glowTexture
  const size = 128
  const c = document.createElement("canvas")
  c.width = c.height = size
  const ctx = c.getContext("2d")
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, "rgba(255,255,255,1)")
  g.addColorStop(0.18, "rgba(255,255,255,0.45)")
  g.addColorStop(0.45, "rgba(255,255,255,0.12)")
  g.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  glowTexture = new CanvasTexture(c)
  return glowTexture
}

// 배경 먼지: 그래프를 둘러싼 구 안에 흐린 점을 흩뿌린다 (매번 같은 배치)
function makeDust() {
  const pos = new Float32Array(DUST_COUNT * 3)
  let seed = 7
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  for (let i = 0; i < DUST_COUNT; i++) {
    const r = DUST_RADIUS * Math.cbrt(rnd())
    const t = rnd() * Math.PI * 2
    const u = rnd() * 2 - 1
    const s = Math.sqrt(1 - u * u)
    pos[i * 3] = r * s * Math.cos(t)
    pos[i * 3 + 1] = r * s * Math.sin(t)
    pos[i * 3 + 2] = r * u
  }
  const geo = new BufferGeometry()
  geo.setAttribute("position", new BufferAttribute(pos, 3))
  // 둥근 점으로 그린다 (그림 없이 그리면 가까이 있는 먼지가 네모로 보인다)
  const mat = new PointsMaterial({
    color: 0xffffff,
    size: 3,
    map: getGlowTexture(),
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  })
  return new Points(geo, mat)
}

// 실 위 안내에 넣는 태그 이름 (HTML로 그려지므로 특수 문자를 바꾼다)
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
}

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
  return nodeCount < 8 ? 96 : 24
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

// 확대·축소 버튼 한 번에 카메라 거리가 바뀌는 비율
const ZOOM_STEP = 1.3
const ZOOM_MS = 400

// data: { nodes, links } / category: 화면에 보이는 데이터의 카테고리, null이면 전체 그래프
//   (전체 그래프도 노드 = 태그. node.category가 점 색, node.showLabel이 이름 표시, node.catLabel이 카테고리 이름)
// fitKey: 값이 바뀌면 전체가 보이게 다시 맞춘다 (사이드바를 닫을 때)
// highlightNames: 찾은 노드 이름(소문자) Set. AI 검색 결과에서 온다. 없으면 null
// focusNames: 찾은 노드 중 카메라가 중심으로 잡을 이름(소문자) Set. 질문에서 AI가 뽑은 태그. 없으면 null
// selectedName: 선택한 태그 이름. 그 노드와 이웃을 계속 밝게 보여준다. 없으면 null
// onBackgroundClick: 빈 공간을 눌렀을 때 (선택 해제용)
// onLinkClick(link): 카테고리 그래프에서 실을 눌렀을 때. link.source/target은 노드 객체
// selectedPair: { a, b } 실로 고른 두 태그 이름. 두 노드와 그 실을 밝게 보여준다. 없으면 null
// controlsRef: { zoomBy(배율), fit() }를 받아 갈 ref (그래프 위 확대·축소·전체 보기 버튼용)
function KnowledgeGraph({
  data,
  category,
  onNodeClick,
  onBackgroundClick,
  fitKey = 0,
  highlightNames = null,
  focusNames = null,
  selectedName = null,
  selectedPair = null,
  onLinkClick,
  controlsRef,
}) {
  const boxRef = useRef(null)
  const fgRef = useRef(null)
  const fittedRef = useRef(false) // 데이터마다 화면 맞춤은 한 번만
  const draggingRef = useRef(false) // 드래그 중에는 마우스 강조가 다른 노드로 바뀌지 않게
  const labelsRef = useRef(new Map()) // 노드 id → 글자 객체 (흐리게 만들 때 사용)
  const glowsRef = useRef(new Map()) // 노드 id → 빛 번짐 객체
  const catLabelsRef = useRef(new Map()) // 노드 id → 카테고리 이름 (전체 그래프)
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
    fg.d3Force("charge")?.distanceMax(CHARGE_RANGE)
    fg.d3ReheatSimulation()
  }, [data])

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

  // 선택한 태그 이름 → 지금 그래프의 노드 id
  const selectedId = useMemo(() => {
    if (!selectedName) return null
    return idByName.get(String(selectedName).toLowerCase()) ?? null
  }, [selectedName, idByName])

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

  // 지금까지 켜진 찾은 노드
  // 연출이 시작되기 전(카테고리 이동 후 그래프가 자리 잡는 동안)에는 null → 평소처럼 모두 밝게 둔다
  // (빈 Set을 주면 그동안 그래프 전체가 어두워져 멈춘 것처럼 보인다)
  // 연출이 시작되면(startReveal이 key를 맞추면) 빈 Set부터 하나씩 켜진다
  const revealedIds = useMemo(() => {
    if (!highlightIds || reveal.key !== hitKey) return null
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
      // 결과가 바뀌거나 사라지면 연출 상태도 비운다
      // (안 비우면 같은 질문을 다시 검색했을 때 이전 연출이 멈춘 자리에서 그대로 남는다)
      setReveal({ key: null, count: 0 })
    }
  }, [hitKey, showHits])

  // 실로 고른 두 태그 → 지금 그래프의 노드 id
  const pairIds = useMemo(() => {
    if (!selectedPair) return null
    const a = idByName.get(String(selectedPair.a).toLowerCase())
    const b = idByName.get(String(selectedPair.b).toLowerCase())
    return a != null && b != null ? new Set([a, b]) : null
  }, [selectedPair, idByName])

  // 그래프 위 버튼: 확대·축소는 지금 보는 중심을 그대로 두고 카메라 거리만 바꾼다
  useImperativeHandle(
    controlsRef,
    () => ({
      zoomBy(factor) {
        const fg = fgRef.current
        if (!fg) return
        const cam = fg.camera()
        const t = fg.controls()?.target ?? { x: 0, y: 0, z: 0 }
        const k = 1 / factor
        fg.cameraPosition(
          {
            x: t.x + (cam.position.x - t.x) * k,
            y: t.y + (cam.position.y - t.y) * k,
            z: t.z + (cam.position.z - t.z) * k,
          },
          { x: t.x, y: t.y, z: t.z },
          motionMs(ZOOM_MS)
        )
      },
      fit() {
        fgRef.current?.zoomToFit(motionMs(600), fitPadding(latestRef.current.nodeCount ?? 0))
      },
      step: ZOOM_STEP,
    }),
    []
  )

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
      if (pairIds) return pairIds.has(id)
      if (revealedIds) return revealedIds.has(id)
      return true
    },
    [focusId, neighbors, pairIds, revealedIds]
  )

  // 양 끝 노드가 모두 켜지면 그 실이 밝아지고 입자가 흐른다
  const isLinkLit = useCallback(
    (l) => {
      const a = endId(l.source)
      const b = endId(l.target)
      if (focusId != null) return a === focusId || b === focusId
      if (pairIds) return pairIds.has(a) && pairIds.has(b)
      if (revealedIds) return revealedIds.has(a) && revealedIds.has(b)
      return false
    },
    [focusId, pairIds, revealedIds]
  )

  // 입자: 밝은 실에 흐른다. 검색 연출 중에는 검색 실만 끈다 (마우스 올림·선택 실은 평소처럼)
  const particlesOn = !revealing || focusId != null

  const focusing = focusId != null || pairIds != null || revealedIds != null

  // 점 색: 카테고리 그래프는 그 카테고리 색, 전체 그래프는 그 태그를 가장 많이 쓴 카테고리 색
  const colorOf = useCallback((node) => categoryColor(category ?? node.category ?? node.name), [category])

  // 색: 찾은 노드는 어떤 강조 중에도 라임 계열을 유지한다
  function nodeColorOf(node) {
    const lit = isLit(node.id)
    if (isHit(node.id)) return lit ? HIT_COLOR : HIT_DIM
    return lit ? colorOf(node) : NODE_DIM
  }

  // 글자와 빛 번짐은 three.js 객체라 색 함수로 못 바꾸므로 직접 바꾼다
  // 색은 바뀔 때만 넣는다 (SpriteText는 색을 넣을 때마다 글자 그림을 다시 그린다)
  useEffect(() => {
    for (const [id, sprite] of labelsRef.current) {
      const strong = id === selectedId || isHit(id)
      // 전체 그래프의 카테고리 이름은 카테고리 색 그대로 둔다
      const color = strong ? LABEL_STRONG : sprite.userData.baseColor
      if (sprite.color !== color) sprite.color = color
      sprite.position.y = labelY(sprite.userData.baseRadius, valScale(id))
      sprite.material.opacity = isLit(id) ? 1 : 0.15
      // 평소에 이름을 달지 않는 태그도 선택·호버·검색으로 강조되면 이름을 보인다
      sprite.visible = sprite.userData.always || (focusing && isLit(id))
    }
    for (const [id, cat] of catLabelsRef.current) cat.material.opacity = isLit(id) ? 1 : 0.15
    for (const [id, glow] of glowsRef.current) {
      const lit = isLit(id)
      const color = isHit(id) ? HIT_COLOR : glow.userData.baseColor
      glow.material.color.set(color)
      glow.material.opacity = lit ? (isHit(id) || id === selectedId ? 0.8 : GLOW_OPACITY) : GLOW_DIM_OPACITY
      const r = glow.userData.baseRadius * Math.cbrt(valScale(id)) * GLOW_SCALE
      glow.scale.set(r, r, 1)
    }
  }, [isLit, isHit, valScale, selectedId, focusing])

  // 노드 하나에 붙는 것: 빛 번짐 + 이름 (+ 전체 그래프에서는 무리마다 카테고리 이름)
  // 전체 그래프는 자료가 많은 태그에만 이름을 단다 (node.showLabel). 카테고리 그래프는 모두
  // category가 바뀔 때만 다시 만든다 (강조할 때마다 다시 만들지 않게)
  const makeLabel = useCallback(
    (node) => {
      const baseRadius = Math.cbrt(node.val || 1) * NODE_REL_SIZE
      const color = colorOf(node)
      const group = new Group()

      const glow = new Sprite(
        new SpriteMaterial({
          map: getGlowTexture(),
          color,
          transparent: true,
          opacity: GLOW_OPACITY,
          blending: AdditiveBlending,
          depthWrite: false,
        })
      )
      glow.scale.set(baseRadius * GLOW_SCALE, baseRadius * GLOW_SCALE, 1)
      glow.userData.baseRadius = baseRadius
      glow.userData.baseColor = color
      group.add(glow)
      glowsRef.current.set(node.id, glow)

      {
        const label = new SpriteText(node.name)
        label.userData.always = !!category || node.showLabel !== false
        label.visible = label.userData.always
        label.userData.baseColor = LABEL_COLOR
        label.color = LABEL_COLOR
        label.textHeight = 5.5
        label.fontFace = 'Pretendard, "Noto Sans KR", system-ui, sans-serif'
        label.fontWeight = "500"
        label.fontSize = 64
        label.userData.baseRadius = baseRadius
        label.position.y = labelY(baseRadius, 1)
        label.material.depthWrite = false
        group.add(label)
        labelsRef.current.set(node.id, label)
      }

      // 카테고리 이름: 그 카테고리에서 가장 큰 태그 위에 카테고리 색 명조로
      if (!category && node.catLabel) {
        const cat = new SpriteText(node.catLabel)
        cat.color = categoryColor(node.catLabel)
        cat.textHeight = 6
        cat.fontFace = '"Noto Serif KR", "Nanum Myeongjo", Georgia, serif'
        cat.fontWeight = "400"
        cat.fontSize = 64
        cat.position.y = baseRadius + LABEL_GAP + 4
        cat.material.depthWrite = false
        group.add(cat)
        catLabelsRef.current.set(node.id, cat)
      } else {
        catLabelsRef.current.delete(node.id)
      }
      return group
    },
    [category, colorOf]
  )

  // 배경 먼지: 그래프가 만들어질 때 한 번 넣는다
  const hasGraph = nodeCount > 0 && size.w > 0
  useEffect(() => {
    const fg = fgRef.current
    if (!hasGraph || !fg) return
    const dust = makeDust()
    fg.scene().add(dust)
    return () => {
      fg.scene().remove(dust)
      dust.geometry.dispose()
      dust.material.dispose()
    }
  }, [hasGraph])

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

  // 평소 실: 출발 노드의 카테고리 색을 어둡게 (전체 그래프는 카테고리마다, 카테고리 그래프는 한 색)
  function linkBaseColor(l) {
    const src = typeof l.source === "object" ? l.source : { name: l.source }
    return dimHex(colorOf(src), LINK_BASE_LEVEL)
  }

  // 실 위에 올리면 손가락 모양
  // 전체 그래프도 이제 태그 그래프라 실 = 두 태그를 함께 가진 자료
  const linkClickable = !!onLinkClick
  function handleLinkHover(link) {
    if (!linkClickable || draggingRef.current || hoverId != null) return
    if (boxRef.current) boxRef.current.style.cursor = link ? "pointer" : ""
  }

  // 실 위 안내: 두 태그를 함께 쓴 자료 수
  function linkLabelOf(l) {
    if (!linkClickable) return ""
    const name = (end) => (typeof end === "object" ? end.name : end)
    const n = l.weight ?? 1
    return `<div style="padding:6px 10px;border-radius:10px;background:rgba(10,10,12,.9);border:1px solid rgba(255,255,255,.16);font:13px Pretendard,'Noto Sans KR',sans-serif;color:#f2f2f0">${escapeHtml(name(l.source))} + ${escapeHtml(name(l.target))}<br><span style="color:#a3a3a0">함께 쓴 자료 ${n}건. 누르면 모아 봅니다</span></div>`
  }

  // 태그를 누르면 카메라가 그 노드 쪽으로 다가간다
  function handleNodeClick(node) {
    const fg = fgRef.current
    if (fg) focusCamera(fg, node, motionMs(800))
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
          backgroundColor="#000000"
          showNavInfo={false}
          nodeLabel={() => ""}
          nodeVal={(node) => (node.val || 1) * valScale(node.id)}
          nodeRelSize={NODE_REL_SIZE}
          nodeResolution={24}
          nodeOpacity={0.9}
          nodeColor={nodeColorOf}
          nodeThreeObject={makeLabel}
          nodeThreeObjectExtend={true}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          onBackgroundClick={onBackgroundClick}
          onNodeDrag={handleNodeDrag}
          onNodeDragEnd={handleNodeDragEnd}
          onLinkClick={linkClickable ? onLinkClick : undefined}
          onLinkHover={handleLinkHover}
          linkLabel={linkLabelOf}
          linkHoverPrecision={6}
          linkCurvature={0.12}
          linkOpacity={0.7}
          linkWidth={(l) => (isLinkLit(l) ? (pairIds ? 2 : 1.2) : 0)}
          linkColor={(l) => (!focusing ? linkBaseColor(l) : isLinkLit(l) ? LINK_LIT : LINK_DIM)}
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
