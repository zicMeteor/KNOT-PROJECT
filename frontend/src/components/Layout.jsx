import { NavLink, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import styles from "./Layout.module.css"

const MENU = [
  { to: "/add", label: "자료 추가" },
  { to: "/graph", label: "지식 그래프" },
  { to: "/library", label: "전체 자료" },
]

// 여백 없이 화면 전체를 쓰는 페이지
const FULL_PAGES = ["/graph"]
// 메뉴를 첫 화면 위에 투명하게 겹치는 페이지 (첫 화면 배경이 메뉴 뒤까지 이어진다)
const OVER_PAGES = ["/"]

function Layout() {
  const { pathname } = useLocation()
  const full = FULL_PAGES.includes(pathname)
  const over = OVER_PAGES.includes(pathname)
  const { me, signOut } = useAuth() ?? {}
  const ai = me?.ai

  return (
    <div className={full ? styles.appFull : undefined}>
      <nav className={over ? `${styles.nav} ${styles.over}` : styles.nav} aria-label="주 메뉴">
        {/* 서비스 이름. 누르면 홈으로 (홈 메뉴를 대신한다) */}
        <NavLink to="/" end className={styles.brand} aria-label="KNOT 홈">
          KNOT
        </NavLink>
        <div className={styles.links}>
          {MENU.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              className={({ isActive }) =>
                isActive ? `${styles.link} ${styles.active}` : styles.link
              }
            >
              {m.label}
            </NavLink>
          ))}
        </div>
        {/* 로그인을 켠 서버에서만: 설문, AI 사용량, 아이디, 로그아웃 */}
        {me?.auth && (
          <div className={styles.me}>
            {me.survey_url && (
              <a className={styles.link} href={me.survey_url} target="_blank" rel="noreferrer">
                설문
              </a>
            )}
            {ai?.limit != null && (
              <span className={styles.usage} title={ai.period === "week" ? "이번 주 AI 사용 횟수" : "오늘 AI 사용 횟수"}>
                AI {ai.used}/{ai.limit}
              </span>
            )}
            <span className={styles.user}>{me.username}</span>
            <button type="button" className={styles.logout} onClick={signOut}>
              로그아웃
            </button>
          </div>
        )}
      </nav>
      <main className={full ? styles.mainFull : styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

export default Layout