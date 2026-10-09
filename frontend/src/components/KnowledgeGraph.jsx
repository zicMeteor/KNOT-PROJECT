import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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

// 검색으로 찾은 노드들이 한 화면에 들어오게 카메라를 맞춘다
// 하나뿐이면 그 노드로 다가간다 (점 하나에 맞추면 카메라가 노드 안으로 들어가 버린다)
function fitToHits(fg, ids, nodes, ms) {
  if (!fg || !ids || ids.size === 0) return
  if (ids.size === 1) {
    const [only] = ids
    const node = nodes.find((n) => n.id === only)
    if (node) focusCamera(fg, node, ms)
    return
  }
  fg.zoomToFit(ms, fitPadding(ids.size), (n) => ids.has(n.id))
}

// 시뮬레이션이 시작되면 link.source/target이 id에서 노드 객체로 바뀐다
function endId(end) {
  return typeof end === "object" ? end.id : end
}

// data: { nodes, links } / category: 화면에 보이는 데이터의 카테고리, null이면 전체 그래프
// fitKey: 값이 바뀌면 전체가 보이게 다시 맞춘다 (사이드바를 닫을 때)
// highlightNames: 찾은 노드 이름(소문자) Set. AI 검색 결과에서 온다. 없으면 null
// selectedName: 선택한 태그 이름. 그 노드와 이웃을 계속 밝게 보여준다. 없으면 null
// onBackgroundClick: 빈 공간을 눌렀을 때 (선택 해제용)
function KnowledgeGraph({
  data,
  category,
  onNodeClick,
  onBackgroundClick,
  fitKey = 0,
  highlightNames = null,
  selectedName = null,
}) {
  const boxRef = useRef(null)
  const fgRef = useRef(null)
  const fittedRef = useRef(false) // 데이터마다 화면 맞춤은 한 번만
  const draggingRef = useRef(false) // 드래그 중에는 마우스 강조가 다른 노드로 바뀌지 않게
  const labelsRef = useRef(new Map()) // 노드 id → 글자 객체 (흐리게 만들 때 사용)
  const hadHitsRef = useRef(false) // 직전에 검색 결과가 있었는지 (검색을 지울 때 전체로 돌아가기용)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hoverId, setHoverId] = useState(null)

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
      fgRef.current?.zoomToFit(600, fitPadding(nodeCount))
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

  // 선택한 태그 이름 → 지금 그래프의 노드 id. 카테고리 그래프에서만 의미가 있다
  const selectedId = useMemo(() => {
    if (!selectedName || !category || !data) return null
    const key = String(selectedName).toLowerCase()
    return data.nodes.find((n) => String(n.name).toLowerCase() === key)?.id ?? null
  }, [selectedName, category, data])

  // 검색 강조: 이름이 맞는 노드 id 집합. 지금 그래프에 맞는 노드가 하나도 없으면 강조하지 않는다
  // (모든 노드가 흐려져 고장 난 것처럼 보이는 것을 막는다)
  const highlightIds = useMemo(() => {
    if (!highlightNames || highlightNames.size === 0 || !data) return null
    const ids = new Set()
    for (const n of data.nodes) {
      if (highlightNames.has(String(n.name).toLowerCase())) ids.add(n.id)
    }
    return ids.size > 0 ? ids : null
  }, [highlightNames, data])

  const isHit = useCallback((id) => highlightIds?.has(id) ?? false, [highlightIds])

  // 그래프가 처음 자리 잡으면 화면을 맞춘다. 검색 결과가 있으면 찾은 노드 쪽으로, 없으면 전체
  // (검색 후 다른 카테고리로 자동 이동한 경우가 여기에 해당한다)
  function handleEngineStop() {
    if (fittedRef.current) return
    fittedRef.current = true
    const fg = fgRef.current
    if (highlightIds) fitToHits(fg, highlightIds, data.nodes, 400)
    else fg?.zoomToFit(400, fitPadding(nodeCount))
  }

  // 같은 그래프에서 검색 결과가 바뀌면 찾은 노드 쪽으로, 검색을 지우면 전체가 보이게 카메라를 옮긴다
  // 그래프가 아직 자리 잡는 중이면(fittedRef가 false) handleEngineStop이 대신 맞춘다
  // 오른쪽 사이드바가 열리며 캔버스 크기가 바뀌므로 조금 늦게 실행한다
  useEffect(() => {
    const hadHits = hadHitsRef.current
    hadHitsRef.current = highlightIds != null
    if (!fittedRef.current) return
    if (!highlightIds && !hadHits) return
    const id = setTimeout(() => {
      const fg = fgRef.current
      if (highlightIds) fitToHits(fg, highlightIds, data?.nodes ?? [], 800)
      else fg?.zoomToFit(800, fitPadding(nodeCount))
    }, 100)
    return () => clearTimeout(id)
  }, [highlightIds])

  // 노드 크기 배율: 선택한 노드 > 찾은 노드 > 보통
  const valScale = useCallback(
    (id) => (id === selectedId ? SELECTED_VAL_SCALE : isHit(id) ? HIT_VAL_SCALE : 1),
    [selectedId, isHit]
  )

  // 밝기 우선순위: 마우스 올림 > 선택한 태그 > 검색 결과 > 모두 밝게
  // 마우스 올림과 선택은 "그 노드 + 이웃"을 밝게 한다
  const focusId = hoverId ?? selectedId

  const isLit = useCallback(
    (id) => {
      if (focusId != null) return id === focusId || neighbors.get(focusId)?.has(id)
      if (highlightIds) return highlightIds.has(id)
      return true
    },
    [focusId, neighbors, highlightIds]
  )

  const isLinkLit = useCallback(
    (l) => {
      const a = endId(l.source)
      const b = endId(l.target)
      if (focusId != null) return a === focusId || b === focusId
      if (highlightIds) return highlightIds.has(a) && highlightIds.has(b)
      return false
    },
    [focusId, highlightIds]
  )

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
    if (category && fg) focusCamera(fg, node, 800)
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
          linkDirectionalParticles={(l) => (isLinkLit(l) ? 2 : 0)}
          linkDirectionalParticleWidth={1.6}
          linkDirectionalParticleSpeed={0.006}
          linkDirectionalParticleColor={() => LINK_LIT}
        />
      )}
    </div>
  )
}

export default KnowledgeGraph