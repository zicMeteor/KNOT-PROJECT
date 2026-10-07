import { useState } from "react"
import { useGraphData } from "../hooks/useGraphData"
import Button from "../components/ui/Button"
import SidebarIcon from "../components/ui/SidebarIcon"
import CategoryTree from "../components/CategoryTree"
import KnowledgeGraph from "../components/KnowledgeGraph"
import TagPanel from "../components/TagPanel"
import ReclassifyModal from "../components/ReclassifyModal"
import styles from "./GraphPage.module.css"

function GraphPage() {
  const [category, setCategory] = useState(null) // null이면 카테고리(전체) 그래프
  const [tag, setTag] = useState(null) // 오른쪽 사이드바에 열린 태그
  const [reloadKey, setReloadKey] = useState(0) // 재분류 후 다시 불러오기용
  const [modalOpen, setModalOpen] = useState(false)
  const [notice, setNotice] = useState(null)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(false)

  const { data, error } = useGraphData(category, reloadKey)

  function goAll() {
    setCategory(null)
    setTag(null)
  }

  function selectCategory(name) {
    setCategory(name)
    setTag(null)
  }

  function selectTag(cat, t) {
    setCategory(cat)
    setTag(t)
    setRightOpen(true)
  }

  function handleNodeClick(node) {
    if (!category) selectCategory(node.name)
    else selectTag(category, node.name)
  }

  function handleApplied(count) {
    setTag(null) // 열려 있던 태그가 사라졌을 수 있으므로 비운다
    setReloadKey((k) => k + 1)
    setNotice(count + "건을 재분류했습니다")
  }

  let status = null
  if (error) status = "오류: " + error
  else if (!data) status = "불러오는 중…"
  else if (data.nodes.length === 0) status = "첫 자료를 추가해 보세요"
  else if (notice) status = notice

  return (
    <div className={styles.page}>
      {leftOpen && (
        <aside className={styles.left}>
          <div className={styles.sideHead}>
            <span className={styles.sideTitle}>지식 그래프</span>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setLeftOpen(false)}
              aria-label="왼쪽 사이드바 닫기"
              title="사이드바 닫기"
            >
              <SidebarIcon side="left" />
            </button>
          </div>
          <div className={styles.sideBody}>
            <CategoryTree
              reloadKey={reloadKey}
              currentCategory={category}
              currentTag={tag}
              onSelectAll={goAll}
              onSelectCategory={selectCategory}
              onSelectTag={selectTag}
            />
          </div>
        </aside>
      )}

      <section className={styles.center}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            {!leftOpen && (
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.floating}`}
                onClick={() => setLeftOpen(true)}
                aria-label="왼쪽 사이드바 열기"
                title="사이드바 열기"
              >
                <SidebarIcon side="left" />
              </button>
            )}
            {status && <p className={styles.status}>{status}</p>}
          </div>
          <div className={styles.toolbarGroup}>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(true)}>
              재분류
            </Button>
            {!rightOpen && (
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.floating}`}
                onClick={() => setRightOpen(true)}
                aria-label="오른쪽 사이드바 열기"
                title="사이드바 열기"
              >
                <SidebarIcon side="right" />
              </button>
            )}
          </div>
        </div>

        <KnowledgeGraph data={data} category={category} onNodeClick={handleNodeClick} />
      </section>

      {rightOpen && (
        <aside className={styles.right}>
          <div className={styles.sideHead}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setRightOpen(false)}
              aria-label="오른쪽 사이드바 닫기"
              title="사이드바 닫기"
            >
              <SidebarIcon side="right" />
            </button>
            <span className={styles.sideTitle}>{tag ?? "자료"}</span>
          </div>
          <div className={styles.sideBody}>
            {tag ? (
              <TagPanel tag={tag} category={category} />
            ) : (
              <p className={styles.placeholder}>
                왼쪽 트리나 그래프에서 태그를 선택하면 관련 자료가 여기에 나옵니다.
              </p>
            )}
          </div>
        </aside>
      )}

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