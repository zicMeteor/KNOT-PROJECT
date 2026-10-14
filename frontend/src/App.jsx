import { BrowserRouter, Routes, Route } from "react-router-dom"
import AuthGate from "./components/AuthGate"
import Layout from "./components/Layout"
import HomePage from "./pages/HomePage"
import AddPage from "./pages/AddPage"
import GraphPage from "./pages/GraphPage"
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
            <Route path="/graph" element={<GraphPage />} />
            <Route path="/library" element={<LibraryPage />} />
          </Route>
        </Routes>
      </AuthGate>
    </BrowserRouter>
  )
}

export default App
