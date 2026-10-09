import { useEffect, useMemo, useRef, useState } from "react"
import { useGraphData } from "../hooks/useGraphData"
import { useAiSearch } from "../hooks/useAiSearch"
import Button from "../components/ui/Button"
import SidebarIcon from "../components/ui/SidebarIcon"
import CategoryTree from "../components/CategoryTree"
import KnowledgeGraph from "../components/KnowledgeGraph"
import TagPanel from "../components/TagPanel"
import AiSearchBar from "../components/AiSearchBar"
import AiSearchPanel from "../components/AiSearchPanel"
import ReclassifyModal from "../components/ReclassifyModal"
import styles from "./GraphPage.module.css"

function GraphPage() {
  const [category, setCategory] = useState(null) // 선택한 카테고리. null이면 전체 그래프
  const [tag, setTag] = useState(null) // 오른쪽 사이드바에 열린 태그
  const [rightMode, setRightMode] = useState("tag") // 오른쪽 사이드바 내용: "tag" | "search"
  const [reloadKey, setReloadKey] = useState(0) // 재분류 후 다시 불러오기용
  const [modalOpen, setModalOpen] = useState(false)
  const [notice, setNotice] = useState(null)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(false)
  const [fitKey, setFitKey] = useState(0) // 사이드바를 닫을 때 그래프를 다시 맞추는 신호
  const autoNavRef = useRef(null) // 자동 이동을 이미 처리한 검색 결과 (같은 결과로 두 번 이동하지 않게)

  // dataCategory: 지금 화면에 보이는 데이터의 카테고리 (불러오는 동안은 category와 다를 수 있다)
  const { data, dataCategory, loading, error } = useGraphData(category, reloadKey)
  const search = useAiSearch()

  // 재분류 완료 문구는 4초 뒤 사라진다
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(id)
  }, [notice])

  // 검색이 끝나면 찾은 자료가 있는 카테고리(태그 그래프)로 이동한다
  // 1. 질문에서 AI가 뽑은 카테고리(analysis.category)가 결과에 있으면 그 카테고리로
  // 2. 아니면 결과가 가장 많은 카테고리로 (같으면 결과 목록에서 먼저 나온 쪽)
  // 검색 중에 사용자가 태그를 눌렀다면(rightMode가 "tag") 화면을 빼앗지 않는다
  useEffect(() => {
    const result = search.result
    if (search.status !== "done" || !result || autoNavRef.current === result) return
    autoNavRef.current = result
    if (rightMode !== "search") return

    // 카테고리별 결과 건수 (Map은 넣은 순서를 지키므로 건수가 같으면 먼저 나온 쪽이 남는다)
    const counts = new Map()
    for (const c of result.contents) {
      if (c.category) counts.set(c.category, (counts.get(c.category) ?? 0) + 1)
    }
    if (counts.size === 0) return

    const asked = result.analysis?.category
    let target = asked && counts.has(asked) ? asked : null
    if (!target) {
      let best = 0
      for (const [name, n] of counts) {
        if (n > best) {
          best = n
          target = name
        }
      }
    }

    if (target !== category) {
      setCategory(target)
      setTag(null)
    }
  }, [search.status, search.result, rightMode, category])

  // AI 검색 강조: 찾은 자료 기준 (패널 목록과 그래프가 항상 일치하도록)
  // 전체 그래프 → 찾은 자료의 카테고리 노드
  // 카테고리 그래프 → 이 카테고리에 속한 찾은 자료들의 태그 노드
  const highlightNames = useMemo(() => {
    if (search.status !== "done" || !search.result) return null
    const contents = search.result.contents
    const names = dataCategory
      ? contents.filter((c) => c.category === dataCategory).flatMap((c) => c.tags ?? [])
      : contents.map((c) => c.category)
    return new Set(names.filter(Boolean).map((n) => String(n).toLowerCase()))
  }, [search.status, search.result, dataCategory])

  function goAll() {
    setCategory(null)
    setTag(null)
  }

  function selectCategory(name) {
    setCategory(name)
    setTag(null)
  }

  function closeLeft() {
    setLeftOpen(false)
    setFitKey((k) => k + 1)
  }

  function closeRight() {
    setRightOpen(false)
    setFitKey((k) => k + 1)
  }

  function selectTag(cat, t) {
    setCategory(cat)
    setTag(t)
    setRightMode("tag")
    setRightOpen(true)
  }

  // 화면에 보이는 노드 기준으로 판단해야 불러오는 중에 눌러도 어긋나지 않는다
  function handleNodeClick(node) {
    if (!dataCategory) selectCategory(node.name)
    else selectTag(dataCategory, node.name)
  }

  // 빈 공간을 누르면 태그 선택을 푼다. 검색 결과가 있으면 검색 패널로 돌아간다
  function handleBackgroundClick() {
    if (!tag) return
    setTag(null)
    if (search.status !== "idle") setRightMode("search")
  }

  function handleSearch(query) {
    setRightMode("search")
    setRightOpen(true)
    search.run(query)
  }

  function handleClearSearch() {
    search.reset()
    if (tag) setRightMode("tag") // 검색을 지우면 열려 있던 태그로 돌아간다
  }

  function handleApplied(count) {
    setTag(null) // 열려 있던 태그가 사라졌을 수 있으므로 비운다
    setReloadKey((k) => k + 1)
    setNotice(count + "건을 재분류했습니다")
  }

  let status = null
  if (error) 
    status = "오류: " + error
  else if (loading) 
    status = "불러오는 중…"
  else if (data && data.nodes.length === 0)
    status = dataCategory ? "이 카테고리에 남은 자료가 없습니다" : "첫 자료를 추가해 보세요"
  else if (notice) 
    status = notice

  // 검색과 태그가 둘 다 있을 때만 탭을 보여준다. 하나만 있으면 제목만
  const searchActive = search.status !== "idle"
  const showTabs = searchActive && tag != null

  let searchTabLabel = "AI로 찾기"

  if (search.status === "loading") 
    searchTabLabel += " · 검색 중"
  else if (search.status === "done" && search.result) 
    searchTabLabel = "AI 결과 " + search.result.contents.length + "건"

  // 그래프에서 계속 강조할 태그: 오른쪽 패널이 열려 태그 자료를 보고 있고,
  // 화면의 그래프가 그 태그의 카테고리일 때만 (패널을 닫으면 강조도 꺼진다)
  const selectedName =
    rightOpen && rightMode === "tag" && tag && dataCategory && dataCategory === category
      ? tag
      : null

  const rightTitle = rightMode === "search" ? "AI로 찾은 자료" : tag ?? "자료"

  return (
    <div className={styles.page}>
      {leftOpen && (
        <aside className={styles.left}>
          <div className={styles.sideHead}>
            <span className={styles.sideTitle}>분류</span>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={closeLeft}
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

        <KnowledgeGraph
          data={data}
          category={dataCategory}
          onNodeClick={handleNodeClick}
          onBackgroundClick={handleBackgroundClick}
          fitKey={fitKey}
          highlightNames={highlightNames}
          selectedName={selectedName}
        />

        <AiSearchBar
          loading={search.status === "loading"}
          hasResult={search.result != null}
          onSubmit={handleSearch}
          onClear={handleClearSearch}
        />
      </section>

      {rightOpen && (
        <aside className={styles.right}>
          <div className={styles.sideHead}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={closeRight}
              aria-label="오른쪽 사이드바 닫기"
              title="사이드바 닫기"
            >
              <SidebarIcon side="right" />
            </button>
            {showTabs ? (
              <div className={styles.tabs} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={rightMode === "search"}
                  className={`${styles.tab} ${rightMode === "search" ? styles.tabActive : ""}`}
                  onClick={() => setRightMode("search")}
                >
                  {searchTabLabel}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={rightMode === "tag"}
                  className={`${styles.tab} ${rightMode === "tag" ? styles.tabActive : ""}`}
                  onClick={() => setRightMode("tag")}
                  title={tag}
                >
                  #{tag}
                </button>
              </div>
            ) : (
              <span className={styles.sideTitle}>{rightTitle}</span>
            )}
          </div>
          <div className={styles.sideBody}>
            {rightMode === "search" ? (
              <AiSearchPanel
                status={search.status}
                result={search.result}
                error={search.error}
              />
            ) : tag ? (
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