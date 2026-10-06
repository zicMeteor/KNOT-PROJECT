import { NavLink, Outlet } from "react-router-dom"
import styles from "./Layout.module.css"

const MENU = [
  { to: "/", label: "홈" },
  { to: "/add", label: "자료 추가" },
  { to: "/graph", label: "지식 그래프" },
  { to: "/search", label: "검색" },
]

function Layout() {
  return (
    <div>
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
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

export default Layout