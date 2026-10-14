// src/components/ui/Notice.jsx
import styles from "./Notice.module.css"

function Notice({ type = "error", children }) {
  return (
    <p
      role={type === "error" ? "alert" : "status"}
      className={`${styles.notice} ${styles[type]}`}
    >
      {/* 점 옆에서 글이 한 덩어리로 흐르도록 감싼다 */}
      <span>{children}</span>
    </p>
  )
}

export default Notice