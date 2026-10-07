import { useEffect, useRef, useState } from "react"
import ForceGraph3D from "react-force-graph-3d"
import { fetchGraph, fetchCategoryGraph } from "../api/graph"
import TagPanel from "../components/TagPanel"
import ReclassifyModal from "../components/ReclassifyModal"
import styles from "./GraphPage.module.css"
import SpriteText from "three-spritetext"
import { categoryColor } from "../constants/categories"

const LABEL_OFFSET = -12

function makeLabel(node) {
  const sprite = new SpriteText(node.name)
  sprite.color = "#ffffff"
  sprite.textHeight = 7
  sprite.fontWeight = "bold"
  sprite.fontSize = 150
  sprite.position.y = LABEL_OFFSET
  return sprite
}

function GraphPage() {
  const [category, setCategory] = useState(null) // null이면 카테고리(전체) 그래프
  const [tag, setTag] = useState(null) // 패널에 열린 태그
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0) // 재분류 후 그래프 재조회용
  const [modalOpen, setModalOpen] = useState(false)
  const [notice, setNotice] = useState(null)

  const boxRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    const job = category ? fetchCategoryGraph(category) : fetchGraph()
    job
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [category, reloadKey])

  useEffect(() => {
    const el = boxRef.current
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  function handleNodeClick(node) {
    if (!category) {
      setCategory(node.name)
    } else {
      setTag(node.name)
    }
  }

  function goAll() {
    setCategory(null)
    setTag(null)
  }

  function handleApplied(count) {
    setTag(null) // 열려 있던 태그가 사라졌을 수 있으므로 패널을 닫는다
    setReloadKey((k) => k + 1)
    setNotice(count + "건을 재분류했습니다")
  }

  const isEmpty = data && data.nodes.length === 0

  return (
    <div>
      <h1>지식 그래프</h1>

      <div className={styles.pathRow}>
        <p>
          <button onClick={goAll}>전체</button>
          {category && <span> &gt; {category}</span>}
          {tag && <span> &gt; {tag}</span>}
        </p>
        <button onClick={() => setModalOpen(true)}>재분류</button>
      </div>

      {notice && <p>{notice}</p>}
      {!data && !error && <p>불러오는 중…</p>}
      {error && <p>오류: {error}</p>}
      {isEmpty && <p>첫 자료를 추가해 보세요</p>}

      <div className={styles.stage}>
        <div ref={boxRef} className={styles.canvas}>
          {data && !isEmpty && size.w > 0 && (
            <ForceGraph3D
                graphData={data}
                width={size.w}
                height={size.h}
                nodeLabel="name"
                nodeVal="val"
                nodeColor={(node) => categoryColor(category ?? node.name)}
                onNodeClick={handleNodeClick}
                linkWidth={2}
                linkOpacity={0.6}
                linkColor={() => "#a1a1aa"}
                nodeThreeObject={makeLabel}
                nodeThreeObjectExtend={true}
            />
          )}
        </div>
        {tag && <TagPanel tag={tag} onClose={() => setTag(null)} />}
      </div>

      {modalOpen && (
        <ReclassifyModal
          onClose={() => setModalOpen(false)}
          onApplied={handleApplied}
        />
      )}
    </div>
  )
}

export default GraphPage