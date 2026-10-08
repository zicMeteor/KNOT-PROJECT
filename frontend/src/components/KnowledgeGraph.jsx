import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ForceGraph3D from "react-force-graph-3d"
import SpriteText from "three-spritetext"
import { categoryColor } from "../constants/categories"
import styles from "./KnowledgeGraph.module.css"

const LABEL_OFFSET = -9
const LABEL_COLOR = "#d4d4d8"
const NODE_DIM = "#3f3f46" // 강조 중일 때 관련 없는 노드
const LINK_BASE = "#52525b" // 평소 실
const LINK_DIM = "#27272a" // 강조 중일 때 관련 없는 실
const LINK_LIT = "#e4e4e7" // 강조된 실과 입자

// 전체(카테고리 6개, 고정)와 카테고리(태그, 계속 늘어남)는 반발 거리를 따로 둔다
const CHARGE_RANGE = { all: 60, category: 90 }

// 태그 노드를 눌렀을 때 카메라가 노드에서 떨어지는 거리
const FOCUS_DISTANCE = 80

// 노드가 적으면 여백을 크게 줘서 과하게 확대되지 않게 한다
function fitPadding(nodeCount) {
  return nodeCount < 8 ? 120 : 40
}

// 시뮬레이션이 시작되면 link.source/target이 id에서 노드 객체로 바뀐다
function endId(end) {
  return typeof end === "object" ? end.id : end
}

// data: { nodes, links } / category: 화면에 보이는 데이터의 카테고리, null이면 전체 그래프
function KnowledgeGraph({ data, category, onNodeClick }) {
  const boxRef = useRef(null)
  const fgRef = useRef(null)
  const fittedRef = useRef(false) // 데이터마다 화면 맞춤은 한 번만
  const draggingRef = useRef(false) // 드래그 중에는 마우스 강조가 다른 노드로 바뀌지 않게
  const labelsRef = useRef(new Map()) // 노드 id → 글자 객체 (흐리게 만들 때 사용)
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

  function handleEngineStop() {
    if (fittedRef.current) return
    fittedRef.current = true
    fgRef.current?.zoomToFit(400, fitPadding(nodeCount))
  }

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

  // 강조 중이 아니면 모두 밝게, 강조 중이면 자신과 이웃만 밝게
  const isLit = useCallback(
    (id) => hoverId == null || id === hoverId || neighbors.get(hoverId)?.has(id),
    [hoverId, neighbors]
  )

  const isLinkLit = useCallback(
    (l) =>
      hoverId != null &&
      (endId(l.source) === hoverId || endId(l.target) === hoverId),
    [hoverId]
  )

  // 글자는 three.js 객체라 색 함수로 못 바꾸므로 직접 투명도를 조절한다
  useEffect(() => {
    for (const [id, sprite] of labelsRef.current) {
      sprite.material.opacity = isLit(id) ? 1 : 0.15
    }
  }, [isLit])

  // 의존성이 없어야 강조할 때 글자 객체가 다시 만들어지지 않는다
  const makeLabel = useCallback((node) => {
    const sprite = new SpriteText(node.name)
    sprite.color = LABEL_COLOR
    sprite.textHeight = 4
    sprite.fontFace = "Pretendard, system-ui, sans-serif"
    sprite.fontWeight = "600"
    sprite.fontSize = 120
    sprite.position.y = LABEL_OFFSET
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

  // 카테고리 그래프에서 태그를 누르면 카메라가 그 노드 쪽으로 다가간다 (공식 click-to-focus 예제 방식)
  function handleNodeClick(node) {
    const fg = fgRef.current
    if (category && fg) {
      const len = Math.hypot(node.x, node.y, node.z) || 1
      const ratio = 1 + FOCUS_DISTANCE / len
      fg.cameraPosition(
        { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
        node,
        800
      )
    }
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
          nodeVal="val"
          nodeRelSize={3}
          nodeResolution={24}
          nodeOpacity={0.95}
          nodeColor={(node) =>
            isLit(node.id) ? categoryColor(category ?? node.name) : NODE_DIM
          }
          nodeThreeObject={makeLabel}
          nodeThreeObjectExtend={true}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          onNodeDrag={handleNodeDrag}
          onNodeDragEnd={handleNodeDragEnd}
          linkCurvature={0.12}
          linkOpacity={0.7}
          linkWidth={(l) => (isLinkLit(l) ? 1.2 : 0)}
          linkColor={(l) =>
            hoverId == null ? LINK_BASE : isLinkLit(l) ? LINK_LIT : LINK_DIM
          }
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