import { BrowserRouter, Routes, Route } from "react-router-dom"
import Layout from "./components/Layout"
import HomePage from "./pages/HomePage"
import AddPage from "./pages/AddPage"
import GraphPage from "./pages/GraphPage"
import LibraryPage from "./pages/LibraryPage"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/add" element={<AddPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/library" element={<LibraryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App