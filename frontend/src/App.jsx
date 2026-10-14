import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import AuthGate from "./components/AuthGate"
import Layout from "./components/Layout"
import HomePage from "./pages/HomePage"
import AddPage from "./pages/AddPage"
// 지식 그래프는 3D 라이브러리(three.js 등)가 커서, 그 화면을 열 때만 따로 받는다
const GraphPage = lazy(() => import("./pages/GraphPage"))
import LibraryPage from "./pages/LibraryPage"

function App() {
  return (
    <BrowserRouter>
      {/* 로그인을 켠 서버면 로그인한 뒤에만 아래 화면이 열린다 */}
      <AuthGate>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/add" element={<AddPage />} />
            <Route
              path="/graph"
              element={
                <Suspense fallback={<p style={{ padding: "48px var(--gut)", color: "var(--color-text-muted)" }}>지식 그래프를 불러오는 중…</p>}>
                  <GraphPage />
                </Suspense>
              }
            />
            <Route path="/library" element={<LibraryPage />} />
          </Route>
        </Routes>
      </AuthGate>
    </BrowserRouter>
  )
}

export default App
