// 홈 구역: 지금까지 쌓인 지식을 숫자로 (자료 수, 태그 수, 태그 사이 연결 수, 카테고리 비율, 많이 쓴 태그)
// 구역이 화면에 들어오는 만큼 숫자가 차오르고 카테고리 막대가 자란다. 모두 실제 저장한 자료에서 센다
import { useMemo, useRef } from "react"
import { CATEGORY_COLORS } from "../../constants/categories"
import { useViewProgress } from "../../lib/scrollPin"
import ways from "./HomeWays.module.css"
import styles from "./HomeStats.module.css"

// 많이 쓴 태그 몇 개를 보여 줄지
const TOP_TAGS = 8

function HomeStats({ contents, graph }) {
  const ref = useRef(null)
  // 구역 윗변이 화면 아래쪽에 닿을 때부터, 구역 높이의 절반쯤 올라오면 다 찬다
  const p = useViewProgress(ref, { startAt: 0.9, span: 0.55 })

  const stats = useMemo(() => {
    const cats = Object.keys(CATEGORY_COLORS)
      .map((name) => ({ name, n: contents.filter((c) => c.category === name).length }))
      .filter((c) => c.n > 0)
      .sort((a, b) => b.n - a.n)
    const days = new Set(contents.map((c) => String(c.createdAt ?? "").slice(0, 10)).filter(Boolean))
    return {
      items: contents.length,
      tags: graph.nodes.length,
      links: graph.links.length,
      days: days.size,
      cats,
      top: [...graph.nodes].sort((a, b) => b.count - a.count).slice(0, TOP_TAGS),
    }
  }, [contents, graph])

  // 숫자는 진행도에 맞춰 0에서 실제 값까지 차오른다
  const grow = Math.min(1, p / 0.8)
  const num = (v) => Math.round(v * grow)

  const figures = [
    { v: stats.items, unit: "건", label: "저장한 자료" },
    { v: stats.tags, unit: "개", label: "태그" },
    { v: stats.links, unit: "개", label: "태그 사이 연결" },
    { v: stats.days, unit: "일", label: "자료를 저장한 날" },
  ]

  return (
    <section ref={ref} className={ways.sec} aria-labelledby="stats-title" style={{ "--g": grow }}>
      <h2 className={ways.h2} id="stats-title">
        지금까지 이만큼 이어졌습니다
      </h2>
      <p className={ways.lead}>
        저장할 때마다 태그가 늘고, 같은 자료에 함께 붙은 태그끼리 선으로 이어집니다.
      </p>

      <dl className={styles.figs}>
        {figures.map((f) => (
          <div key={f.label} className={styles.fig}>
            <dt>{f.label}</dt>
            <dd>
              {/* 화면 낭독기는 차오르는 숫자 대신 실제 값을 읽는다 */}
              <span aria-hidden="true">{num(f.v)}</span>
              <span className={ways.sr}>{f.v}</span>
              <small>{f.unit}</small>
            </dd>
          </div>
        ))}
      </dl>

      <div className={styles.split}>
        <div>
          <h3 className={styles.h3}>카테고리</h3>
          <div className={styles.bar} role="img" aria-label={stats.cats.map((c) => `${c.name} ${c.n}건`).join(", ")}>
            {stats.cats.map((c) => (
              <span
                key={c.name}
                style={{ flexGrow: c.n, background: CATEGORY_COLORS[c.name] }}
                title={`${c.name} ${c.n}건`}
              />
            ))}
          </div>
          <ul className={styles.legend}>
            {stats.cats.map((c) => (
              <li key={c.name}>
                <i style={{ background: CATEGORY_COLORS[c.name] }} aria-hidden="true" />
                {c.name}
                <b>{c.n}</b>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className={styles.h3}>많이 쓴 태그</h3>
          <ol className={styles.tags}>
            {stats.top.map((t, i) => (
              <li key={t.id} style={{ "--i": i, "--w": t.count / (stats.top[0]?.count || 1) }}>
                <span>#{t.label}</span>
                <b>{t.count}</b>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

export default HomeStats
