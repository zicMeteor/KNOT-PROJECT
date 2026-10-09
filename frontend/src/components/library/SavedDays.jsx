// 저장 기록: 최근 14일 동안 날짜별로 저장한 자료를 한 칸씩 쌓아 보여 준다 (칸 색은 카테고리)
// 날짜를 누르면 그날 저장한 자료만 남는다. 같은 날짜를 다시 누르면 풀린다
import { useMemo } from "react"
import { categoryColor } from "../../constants/categories"
import { dayOf, shortDay } from "../../lib/contentMeta"
import styles from "./SavedDays.module.css"

const DAY_COUNT = 14
// 한 날짜에 쌓아 보여 줄 칸 수. 넘는 것은 "+n"으로
const MAX_BLOCKS = 5

// 끝 날짜에서 거꾸로 n일 ("YYYY-MM-DD", 오래된 순). UTC로 계산해 시간대 때문에 날짜가 밀리지 않게 한다
function lastDays(end, n) {
  const t = Date.parse(end + "T00:00:00Z")
  return Array.from({ length: n }, (_, i) =>
    new Date(t - (n - 1 - i) * 86400000).toISOString().slice(0, 10)
  )
}

function SavedDays({ contents, day, onPick }) {
  // 끝 날짜: 가장 최근에 저장한 날
  const days = useMemo(() => {
    const all = contents.map((c) => dayOf(c.createdAt)).filter(Boolean).sort()
    if (all.length === 0) return []
    const byDay = new Map()
    for (const c of contents) {
      const d = dayOf(c.createdAt)
      if (!d) continue
      if (!byDay.has(d)) byDay.set(d, [])
      byDay.get(d).push(c)
    }
    return lastDays(all[all.length - 1], DAY_COUNT).map((d) => ({ day: d, items: byDay.get(d) ?? [] }))
  }, [contents])

  if (days.length === 0) return null

  return (
    <details className={styles.box}>
      <summary className={styles.head}>
        <span className={styles.text}>
          <b>저장 기록</b>
          {day
            ? `${shortDay(day)}에 저장한 자료만 보는 중. 같은 날짜를 다시 누르면 해제됩니다`
            : "날짜별 저장 수. 한 칸이 자료 하나, 색은 카테고리. 날짜를 누르면 그날 저장한 자료만 봅니다"}
        </span>
        <span className={styles.toggle} aria-hidden="true" />
      </summary>
      <div className={styles.days}>
        {days.map(({ day: d, items }) => {
          const on = day === d
          const extra = items.length - MAX_BLOCKS
          return (
            <button
              key={d}
              type="button"
              className={`${styles.day} ${on ? styles.on : day ? styles.dim : ""}`}
              aria-pressed={on}
              aria-label={`${shortDay(d)}에 저장한 자료 ${items.length}건만 보기`}
              disabled={items.length === 0 && !on}
              onClick={() => onPick(on ? null : d)}
            >
              {extra > 0 && <span className={styles.more}>+{extra}</span>}
              {items.slice(0, MAX_BLOCKS).map((c) => (
                <span
                  key={c.id}
                  className={styles.block}
                  style={{ background: categoryColor(c.category) }}
                />
              ))}
            </button>
          )
        })}
      </div>
      <div className={styles.labels} aria-hidden="true">
        {days.map(({ day: d }, i) => (
          <span key={d}>{i % 2 === 0 ? shortDay(d) : ""}</span>
        ))}
      </div>
    </details>
  )
}

export default SavedDays
