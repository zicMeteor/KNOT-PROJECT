import { NavLink, Outlet, useLocation } from "react-router-dom"
import styles from "./Layout.module.css"

const MENU = [
  { to: "/add", label: "자료 추가" },
  { to: "/graph", label: "지식 그래프" },
  { to: "/library", label: "전체 자료" },
]

// 여백 없이 화면 전체를 쓰는 페이지
const FULL_PAGES = ["/graph"]

function Layout() {
  const { pathname } = useLocation()
  const full = FULL_PAGES.includes(pathname)

  return (
    <div className={full ? styles.appFull : undefined}>
      <nav className={styles.nav} aria-label="주 메뉴">
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
      </nav>
      <main className={full ? styles.mainFull : styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

export default Layout