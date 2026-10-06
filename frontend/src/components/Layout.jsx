import { NavLink, Outlet } from "react-router-dom"

function Layout() {
  return (
    <div>
      <nav style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
        <NavLink to="/">홈</NavLink>
        <NavLink to="/add">자료 추가</NavLink>
        <NavLink to="/graph">지식 그래프</NavLink>
        <NavLink to="/search">검색</NavLink>
      </nav>
      <Outlet />
    </div>
  )
}

export default Layout
