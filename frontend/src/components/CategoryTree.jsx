import { useEffect, useMemo, useState } from "react"
import { useContents } from "../hooks/useContents"
import { CATEGORY_COLORS, categoryColor } from "../constants/categories"
import styles from "./CategoryTree.module.css"

const CATEGORY_ORDER = Object.keys(CATEGORY_COLORS)

function tagName(t) {
  return typeof t === "string" ? t : t.name
}

function ChevronIcon({ open }) {
  return (
    <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </span>
  )
}

function GraphIcon() {
  return (
    <span className={styles.icon} aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="6" cy="7" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <circle cx="12" cy="18" r="2.5" />
        <path d="M8.5 7l7-1M7.2 9.2l3.6 6.6M16.8 8.3l-3.6 7.4" />
      </svg>
    </span>
  )
}

function CategoryTree({
  reloadKey = 0,
  currentCategory,
  currentTag,
  onSelectAll,
  onSelectCategory,
  onSelectTag,
}) {
  const { contents, loading, error, reload } = useContents()
  const [expanded, setExpanded] = useState(() => new Set())

  useEffect(() => {
    if (reloadKey > 0) reload()
  }, [reloadKey, reload])

  // 그래프에서 카테고리를 바꿔도 트리에서 그 카테고리가 펼쳐지게
  useEffect(() => {
    if (currentCategory) {
      setExpanded((prev) => new Set(prev).add(currentCategory))
    }
  }, [currentCategory])

  // 카테고리 → (자료 수, 태그별 자료 수)
  const tree = useMemo(() => {
    const map = new Map()
    for (const c of contents) {
      if (!map.has(c.category)) map.set(c.category, { count: 0, tags: new Map() })
      const node = map.get(c.category)
      node.count += 1
      for (const t of c.tags ?? []) {
        const name = tagName(t)
        node.tags.set(name, (node.tags.get(name) ?? 0) + 1)
      }
    }
    return CATEGORY_ORDER.filter((cat) => map.has(cat)).map((cat) => ({
      name: cat,
      count: map.get(cat).count,
      tags: [...map.get(cat).tags].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
      ),
    }))
  }, [contents])

  function handleCategory(name) {
    if (currentCategory !== name) {
      setExpanded((prev) => new Set(prev).add(name))
      onSelectCategory(name)
      return
    }
    // 이미 보고 있는 카테고리면 펼침만 토글
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <nav className={styles.tree} aria-label="카테고리와 태그">
      <button
        type="button"
        className={`${styles.row} ${!currentCategory ? styles.active : ""}`}
        onClick={onSelectAll}
      >
        <GraphIcon />
        <span className={styles.name}>전체 그래프</span>
      </button>

      <p className={styles.section}>카테고리</p>

      {loading && <p className={styles.muted}>불러오는 중…</p>}
      {error && <p className={styles.muted}>오류: {error}</p>}

      <ul className={styles.list}>
        {tree.map((cat) => {
          const open = expanded.has(cat.name)
          const catActive = currentCategory === cat.name && !currentTag
          return (
            <li key={cat.name}>
              <button
                type="button"
                className={`${styles.row} ${catActive ? styles.active : ""}`}
                onClick={() => handleCategory(cat.name)}
                aria-expanded={open}
              >
                <ChevronIcon open={open} />
                <span
                  className={styles.dot}
                  style={{ background: categoryColor(cat.name) }}
                  aria-hidden="true"
                />
                <span className={styles.name}>{cat.name}</span>
                <span className={styles.count}>{cat.count}</span>
              </button>

              {open && (
                <ul className={styles.list}>
                  {cat.tags.map(([t, n]) => {
                    const tagActive = currentCategory === cat.name && currentTag === t
                    return (
                      <li key={t}>
                        <button
                          type="button"
                          className={`${styles.row} ${styles.child} ${tagActive ? styles.active : ""}`}
                          onClick={() => onSelectTag(cat.name, t)}
                          title={t}
                        >
                          <span className={styles.name}>{t}</span>
                          <span className={styles.count}>{n}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default CategoryTree