import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAutoUpdate } from './hooks/useAutoUpdate'
import { PuzzleList } from './components/PuzzleList/PuzzleList'
import { EditorPage } from './pages/EditorPage'
import { PlayerPage } from './pages/PlayerPage'
import './App.css'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export default function App() {
  useAutoUpdate()

  return (
    <AuthProvider>
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="/" element={<PuzzleList />} />
          <Route path="/edit" element={<EditorPage />} />
          <Route path="/edit/:puzzleId" element={<EditorPage />} />
          <Route path="/play/:puzzleId" element={<PlayerPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
