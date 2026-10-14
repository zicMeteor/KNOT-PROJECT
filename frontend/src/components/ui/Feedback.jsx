// AI 결과 아래의 좋아요·싫어요. 한 번 누르면 고정된다 (같은 결과에 여러 번 보내지 않게)
import { useState } from "react"
import { sendFeedback } from "../../api/feedback"
import styles from "./Feedback.module.css"

function Thumb({ down }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={down ? { transform: "rotate(180deg)" } : undefined}>
      <path
        d="M7 10v11H3V10h4zm2 11h8.3a2 2 0 0 0 2-1.6l1.4-7A2 2 0 0 0 18.7 10H14l.8-4.2A1.6 1.6 0 0 0 12 4.6L9 10v11z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// target: analysis | search | reclassify, refValue: 무엇에 대한 평가인지 (주소, 검색어, 목적)
function Feedback({ target, refValue, detail, label = "이 결과가 도움이 됐나요?" }) {
  const [voted, setVoted] = useState(0)

  function vote(value) {
    if (voted) return
    setVoted(value)
    sendFeedback(target, value, refValue, detail)
  }

  return (
    <div className={styles.row} role="group" aria-label={label}>
      <span className={styles.label}>{voted ? "의견 고마워요" : label}</span>
      <button
        type="button"
        className={voted === 1 ? `${styles.btn} ${styles.on}` : styles.btn}
        onClick={() => vote(1)}
        disabled={voted !== 0}
        aria-pressed={voted === 1}
        aria-label="좋아요"
      >
        <Thumb />
      </button>
      <button
        type="button"
        className={voted === -1 ? `${styles.btn} ${styles.on}` : styles.btn}
        onClick={() => vote(-1)}
        disabled={voted !== 0}
        aria-pressed={voted === -1}
        aria-label="싫어요"
      >
        <Thumb down />
      </button>
    </div>
  )
}

export default Feedback
