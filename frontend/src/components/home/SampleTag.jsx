// 예시 자료로 그린 구간임을 알리는 표시 (자료가 없는 계정의 홈에서만)
import styles from "./SampleTag.module.css"

function SampleTag({ children = "예시 자료로 보여 주는 화면" }) {
  return <span className={styles.tag}>{children}</span>
}

export default SampleTag
