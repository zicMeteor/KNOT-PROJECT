import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useGraphData } from "../hooks/useGraphData"
import { useContents } from "../hooks/useContents"
import { buildTagOverview } from "../lib/tagOverview"
import { useAiSearch } from "../hooks/useAiSearch"
import Button from "../components/ui/Button"
import SidebarIcon from "../components/ui/SidebarIcon"
import CategoryTree from "../components/graph/CategoryTree"
import KnowledgeGraph from "../components/graph/KnowledgeGraph"
import TagPanel from "../components/graph/TagPanel"
import PairPanel from "../components/graph/PairPanel"
import AiSearchBar from "../components/graph/AiSearchBar"
import AiSearchPanel from "../components/graph/AiSearchPanel"
import ReclassifyModal from "../components/graph/ReclassifyModal"
import { logEvent } from "../api/events"
import btn from "../components/ui/Button.module.css"
import styles from "./GraphPage.module.css"

function GraphPage() {
  const [category, setCategory] = useState(null) // 선택한 카테고리. null이면 전체 그래프
  const [tag, setTag] = useState(null) // 오른쪽 사이드바에 열린 태그
  const [rightMode, setRightMode] = useState("tag") // 오른쪽 사이드바 내용: "tag" | "search" | "pair"
  const [pair, setPair] = useState(null) // 실로 고른 두 태그 { a, b }
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
  // 전체 그래프, 위쪽 숫자(자료 수), 왼쪽 분류 목록이 함께 쓴다
  const { contents, loading: contentsLoading, error: contentsError, reload: reloadContents } = useContents()
  // 전체 그래프: 서버의 카테고리 그래프 대신 모든 태그를 한 그래프로 (디자인 시안)
  const overview = useMemo(() => buildTagOverview(contents), [contents])
  const graphData = dataCategory ? data : overview
  // 불러오는 중: 카테고리 그래프를 받는 중이거나, "전체"인데 자료 목록을 아직 못 받았을 때
  // (전체 그래프는 자료 목록으로 만들어서, 받기 전에는 빈 그래프가 "자료 0건"으로 보인다)
  const busy = loading || (!dataCategory && contentsLoading)
  const controlsRef = useRef(null) // 확대·축소·전체 보기

  // 홈의 "AI에게" 칸에서 넘겨받은 질문은 바로 찾는다
  const location = useLocation()
  const navigate = useNavigate()
  const handoffQuery = location.state?.q
  const [initialQuery] = useState(handoffQuery ?? "")
  const startHandoff = useEffectEvent((q) => handleSearch(q))
  // 이미 실행했는지 따로 막지 않는다. 개발 모드(StrictMode)에서는 화면이 한 번 내려갔다 올라오며
  // useAiSearch가 첫 검색을 취소하므로, 두 번째 실행이 있어야 결과가 나온다.
  // 넘겨받은 값은 바로 지우므로 다음 렌더링부터는 다시 실행되지 않는다 (새로고침해도 다시 찾지 않는다)
  useEffect(() => {
    if (!handoffQuery) return
    navigate(".", { replace: true, state: null })
    startHandoff(handoffQuery)
  }, [handoffQuery, navigate])

  // 전체 자료의 서랍에서 넘겨받은 카테고리와 태그를 연다
  const handoffCategory = location.state?.category
  const handoffTag = location.state?.tag
  const openHandoff = useEffectEvent((cat, t) => {
    if (t) selectTag(cat, t, "handoff")
    else selectCategory(cat)
  })
  useEffect(() => {
    if (!handoffCategory) return
    navigate(".", { replace: true, state: null })
    openHandoff(handoffCategory, handoffTag)
  }, [handoffCategory, handoffTag, navigate])

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
  // 전체 그래프 → 찾은 자료들의 태그 노드
  // 카테고리 그래프 → 이 카테고리에 속한 찾은 자료들의 태그 노드
  const highlightNames = useMemo(() => {
    if (search.status !== "done" || !search.result) return null
    const contents = search.result.contents
    const names = (dataCategory ? contents.filter((c) => c.category === dataCategory) : contents).flatMap(
      (c) => c.tags ?? []
    )
    return new Set(names.filter(Boolean).map((n) => String(n).toLowerCase()))
  }, [search.status, search.result, dataCategory])

  // 카메라가 중심으로 잡을 태그: 질문에서 AI가 뽑은 태그 (예: "트랜스포머" → Transformer)
  // 찾은 노드 중에 이 태그가 없으면 KnowledgeGraph가 찾은 노드 전체에 맞춘다
  const focusNames = useMemo(() => {
    if (search.status !== "done" || !search.result) return null
    const tags = search.result.analysis?.tags ?? []
    return tags.length > 0 ? new Set(tags.map((t) => String(t).toLowerCase())) : null
  }, [search.status, search.result])

  function goAll() {
    setCategory(null)
    setTag(null)
    setPair(null)
  }

  function selectCategory(name) {
    setCategory(name)
    setTag(null)
    setPair(null)
  }

  function closeLeft() {
    setLeftOpen(false)
    setFitKey((k) => k + 1)
  }

  function closeRight() {
    setRightOpen(false)
  }

  // via: 어디서 골랐는지 (node 그래프 점, tree 왼쪽 목록, pair 실 목록, handoff 다른 화면에서 넘어옴)
  function selectTag(cat, t, via = "tree") {
    logEvent("graph_tag_open", { tag: t, category: cat ?? null, via })
    setCategory(cat)
    setTag(t)
    setPair(null)
    setRightMode("tag")
    setRightOpen(true)
  }

  // 실을 누르면 두 태그를 함께 가진 자료를 오른쪽에 모아 본다
  // (전체 그래프면 모든 카테고리에서, 카테고리 그래프면 그 카테고리에서)
  function handleLinkClick(link) {
    const name = (end) => (typeof end === "object" ? end.name : end)
    setPair({ a: name(link.source), b: name(link.target) })
    setRightMode("pair")
    setRightOpen(true)
  }

  // 선택 해제: 고른 태그와 실을 푼다. 검색 결과가 있으면 검색 패널로 돌아간다
  function clearSelection() {
    setTag(null)
    setPair(null)
    setRightMode(search.status !== "idle" ? "search" : "tag")
  }

  // 화면에 보이는 노드 기준으로 판단해야 불러오는 중에 눌러도 어긋나지 않는다
  // 전체 그래프에서 태그를 누르면 전체 그래프에 머문 채 그 태그의 모든 자료를 보여 준다
  function handleNodeClick(node) {
    selectTag(dataCategory, node.name, "node")
  }

  // 빈 공간을 누르면 태그 선택을 푼다. 검색 결과가 있으면 검색 패널로 돌아간다
  function handleBackgroundClick() {
    if (!tag && !pair) return
    clearSelection()
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
    setPair(null)
    setReloadKey((k) => k + 1)
    reloadContents()
    setNotice(`분류 다시 검토 안 ${count}건을 적용했습니다`)
  }

  let status = null
  if (error) status = "오류: " + error
  else if (busy) status = "불러오는 중…"
  else if (graphData && graphData.nodes.length === 0 && dataCategory) status = "이 카테고리에 남은 자료가 없습니다"
  else if (notice) status = notice
  // 그래프에 점이 하나도 없으면 상태 한 줄 대신 가운데에 무엇이 비었는지와 다음 행동을 보여 준다
  // 태그 없이 메모로만 저장한 자료는 있어도 점이 없으므로, 자료가 아예 없는 경우와 문구를 나눈다
  const empty = !error && !busy && graphData && graphData.nodes.length === 0 && !dataCategory
  const untagged = empty && contents.length > 0

  // 검색과 태그가 둘 다 있을 때만 탭을 보여준다. 하나만 있으면 제목만
  const searchActive = search.status !== "idle"
  const showTabs = searchActive && tag != null
  let searchTabLabel = "AI로 찾기"
  if (search.status === "loading") searchTabLabel = "AI로 찾는 중"
  else if (search.status === "done" && search.result) searchTabLabel = "AI 결과 " + search.result.contents.length + "건"

  // 그래프에서 계속 강조할 태그: 오른쪽 패널이 열려 태그 자료를 보고 있고,
  // 화면의 그래프가 고른 카테고리(전체면 null)와 같을 때만 (패널을 닫으면 강조도 꺼진다)
  const selectedName = rightOpen && rightMode === "tag" && tag && dataCategory === category ? tag : null

  const rightTitle =
    rightMode === "search"
      ? "AI로 찾은 자료"
      : rightMode === "pair" && pair
        ? `#${pair.a} + #${pair.b}`
        : tag ?? "자료"

  // 실로 고른 두 태그: 패널이 열려 있고, 그래프가 그 카테고리일 때만 강조
  const selectedPair = rightOpen && rightMode === "pair" && pair && dataCategory === category ? pair : null
  const hasSelection = tag != null || pair != null

  // 위쪽 숫자: 지금 보는 그래프 기준
  const itemCount = dataCategory
    ? contents.filter((c) => c.category === dataCategory).length
    : contents.length
  const hudCounts =
    graphData && !busy
      ? `자료 ${itemCount}건, 태그 ${graphData.nodes.length}개, 연결 ${graphData.links.length}개`
      : ""

  // 고른 태그: 자료 수와 이웃 태그 수를 그래프 위에 바로 보여 준다 (오른쪽 패널을 보지 않아도 읽히게)
  // 링크의 source/target은 그래프가 그리기 시작하면 노드 객체로 바뀌므로 둘 다 받는다
  const endId = (x) => (typeof x === "object" ? x.id : x)
  const selNode = selectedName ? graphData?.nodes.find((n) => n.name === selectedName) : null
  const selNeighbors = selNode
    ? new Set(
        graphData.links.flatMap((l) => {
          const s = endId(l.source)
          const t = endId(l.target)
          return s === selNode.id ? [t] : t === selNode.id ? [s] : []
        })
      ).size
    : 0
  const selCounts = selNode
    ? `#${selNode.name}: 자료 ${selNode.val ?? 0}건, 이어진 태그 ${selNeighbors}개`
    : ""

  return (
    <div className={styles.page}>
      {leftOpen && (
        <aside className={styles.left}>
          <div className={styles.sideHead}>
            <span className={styles.railTitle}>분류</span>
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
          <p className={styles.railNote}>숫자는 자료 수입니다</p>
          <div className={styles.sideBody}>
            <CategoryTree
              contents={contents}
              loading={contentsLoading}
              error={contentsError}
              currentCategory={category}
              currentTag={tag}
              onSelectAll={goAll}
              onSelectCategory={selectCategory}
              onSelectTag={selectTag}
            />
          </div>
          {/* 설명은 마우스를 올리거나 키보드로 가리킬 때만 말풍선으로 보인다 */}
          <div className={styles.legend}>
            <div className={styles.hintWrap}>
              <button type="button" className={styles.legendBtn} aria-describedby="graph-legend-hint">
                <InfoIcon />
                그래프 보는 법
              </button>
              <span id="graph-legend-hint" role="tooltip" className={styles.hint}>
                점이 클수록 자료가 많은 태그이고, 색은 카테고리입니다. 실을 누르면 두 태그를 함께 쓴 자료만
                모아 봅니다.
              </span>
            </div>
            {/* 분류 다시 검토는 자주 쓰는 기능이 아니라 그래프 위가 아닌 여기에 둔다. 적용 전에 바뀌는 내용을 먼저 보여 준다 */}
            <div className={styles.hintWrap}>
              <Button size="sm" block aria-describedby="recl-hint" onClick={() => setModalOpen(true)}>
                분류 다시 검토
              </Button>
              <span id="recl-hint" role="tooltip" className={styles.hint}>
                목적에 맞게 최근 자료의 분류를 AI가 다시 검토합니다. 적용 전에 바뀌는 내용을 먼저 보여 줍니다.
              </span>
            </div>
          </div>
        </aside>
      )}

      <section className={`${styles.center} ${rightOpen ? styles.centerPanelOpen : ""}`}>
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
            <div className={styles.hud}>
              <h1 className={styles.hudTitle}>{dataCategory ?? "전체"}</h1>
              {hudCounts && <p className={styles.hudCounts}>{hudCounts}</p>}
              {selCounts && <p className={styles.hudSel}>{selCounts}</p>}
              {status && <p className={styles.status}>{status}</p>}
            </div>
          </div>
          <div className={styles.toolbarGroup}>
            <div className={styles.tools} role="toolbar" aria-label="그래프 보기">
              <button type="button" onClick={() => controlsRef.current?.zoomBy(1 / 1.3)} aria-label="축소">
                −
              </button>
              <button type="button" onClick={() => controlsRef.current?.zoomBy(1.3)} aria-label="확대">
                +
              </button>
              <button type="button" onClick={() => controlsRef.current?.fit()}>
                전체 보기
              </button>
              {hasSelection && (
                <button type="button" onClick={clearSelection}>
                  선택 해제
                </button>
              )}
            </div>
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
          data={graphData}
          category={dataCategory}
          onNodeClick={handleNodeClick}
          onBackgroundClick={handleBackgroundClick}
          fitKey={fitKey}
          highlightNames={highlightNames}
          focusNames={focusNames}
          selectedName={selectedName}
          selectedPair={selectedPair}
          onLinkClick={handleLinkClick}
          controlsRef={controlsRef}
        />

        {empty && (
          <div className={styles.empty}>
            <div className={styles.emptyBox}>
              <svg className={styles.emptyMark} width="56" height="16" viewBox="0 0 56 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="5" fill="currentColor" />
                <path d="M13 8h30" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" />
                <circle cx="48" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              {untagged ? (
                <>
                  <p className={styles.emptyTitle}>태그가 붙은 자료가 아직 없습니다</p>
                  <p className={styles.emptyBody}>
                    그래프는 태그를 점으로, 함께 붙은 태그를 실로 그립니다. 태그 없이 저장한 자료
                    {` ${contents.length}건`}은 전체 자료에서 볼 수 있습니다.
                  </p>
                  <Link to="/library" className={`${btn.button} ${btn.primary}`}>
                    전체 자료 보기
                  </Link>
                </>
              ) : (
                <>
                  <p className={styles.emptyTitle}>아직 저장한 자료가 없습니다</p>
                  <p className={styles.emptyBody}>
                    자료를 저장하면 태그가 점으로 생기고, 같은 자료에 함께 붙은 태그끼리 실로 이어집니다.
                  </p>
                  <Link to="/add" className={`${btn.button} ${btn.primary}`}>
                    자료 추가
                  </Link>
                </>
              )}
            </div>
          </div>
        )}

        <AiSearchBar
          loading={search.status === "loading"}
          hasResult={search.result != null || search.status === "error"}
          onSubmit={handleSearch}
          onClear={handleClearSearch}
          initialText={initialQuery}
          panelOpen={rightOpen}
        />

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
              ) : rightMode === "pair" && pair ? (
                <PairPanel
                  a={pair.a}
                  b={pair.b}
                  category={dataCategory}
                  onPickTag={(t) => selectTag(dataCategory, t, "pair")}
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
      </section>

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

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7.25V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.9" fill="currentColor" />
    </svg>
  )
}
