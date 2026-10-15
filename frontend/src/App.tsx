import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { PublicOnly, RequireAuth } from './components/Layout'
import { AuthPage } from './pages/AuthPage'
import { BookPage } from './pages/BookPage'
import { HomePage } from './pages/HomePage'
import { LibraryPage } from './pages/LibraryPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'
import { ShelvesPage } from './pages/ShelvesPage'
import { StatsPage } from './pages/StatsPage'
import { WelcomePage } from './pages/WelcomePage'

export default function App() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/library/:id" element={<BookPage />} />
        <Route path="/shelves" element={<ShelvesPage />} />
        <Route path="/shelves/:shelfId" element={<LibraryPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
