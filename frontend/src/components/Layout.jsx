import { NavLink, Outlet, useLocation } from "react-router-dom"
import styles from "./Layout.module.css"

const MENU = [
  { to: "/", label: "홈" },
  { to: "/add", label: "자료 추가" },
  { to: "/graph", label: "지식 그래프" },
  { to: "/search", label: "검색" },
]

// 여백 없이 화면 전체를 쓰는 페이지
const FULL_PAGES = ["/graph"]

function Layout() {
  const { pathname } = useLocation()
  const full = FULL_PAGES.includes(pathname)

  return (
    <div className={full ? styles.appFull : undefined}>
      <nav className={styles.nav}>
        {MENU.map((m) => (
          <NavLink
            key={m.to}
            to={m.to}
            end={m.to === "/"}
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.active}` : styles.link
            }
          >
            {m.label}
          </NavLink>
        ))}
      </nav>
      <main className={full ? styles.mainFull : styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

export default Layout