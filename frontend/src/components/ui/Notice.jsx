// src/components/ui/Notice.jsx
import styles from "./Notice.module.css"

function Notice({ type = "error", children }) {
  return (
    <p
      role={type === "error" ? "alert" : "status"}
      className={`${styles.notice} ${styles[type]}`}
    >
      {children}
    </p>
  )
}

export default Notice