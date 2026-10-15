import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLogout, useMe } from '../api/hooks'
import { ThemeSelect } from './ThemePicker'
import { LogoMark, MenuIcon, SearchIcon, Spinner, Toaster } from './ui'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/library', label: 'Library' },
  { to: '/shelves', label: 'Shelves' },
  { to: '/stats', label: 'Stats' },
]

export function AppLayout() {
  const { data: me } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  const signOut = () => logout.mutate(undefined, { onSuccess: () => navigate('/welcome') })

  return (
    <>
      <header className={`nav ${open ? 'nav--open' : ''}`}>
        <div className="container nav__inner">
          <Link to="/" className="brand">
            <LogoMark />
            Nook
          </Link>

          <nav className="nav__links" aria-label="Main">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className="nav__link">
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="nav__right">
            <NavLink to="/search" className="btn btn--white btn--sm">
              <SearchIcon size={16} /> Find a book
            </NavLink>
            <NavLink to="/settings" className="nav__link" title={me?.isGuest ? 'Guest account' : me?.email}>
              {me?.displayName ?? 'Account'}
            </NavLink>
          </div>

          <button
            className="btn btn--ghost btn--icon nav__menu-btn"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <MenuIcon />
          </button>
        </div>

        <nav className="nav__panel" aria-label="Mobile">
          {[...LINKS, { to: '/search', label: 'Find a book' }, { to: '/settings', label: 'Settings' }].map((l) => (
            <NavLink key={l.to} to={l.to} end={'end' in l} className="nav__link">
              {l.label}
            </NavLink>
          ))}
          <button className="nav__link link" style={{ textAlign: 'left', textDecoration: 'none' }} onClick={signOut}>
            Sign out
          </button>
        </nav>
      </header>

      {me?.isGuest && <GuestBanner onCreateAccount={() => logout.mutate(undefined, { onSuccess: () => navigate('/register') })} />}

      <main>
        <Outlet />
      </main>

      <Footer onSignOut={signOut} />
      <Toaster />
    </>
  )
}

function GuestBanner({ onCreateAccount }: { onCreateAccount: () => void }) {
  return (
    <div className="guest-banner" role="status">
      <div className="container row row--between" style={{ gap: 8 }}>
        <span>
          <strong>Guest mode.</strong> This is a sample library — change anything you like. It's cleared within a day.
        </span>
        <button className="link" onClick={onCreateAccount}>
          Start your own diary
        </button>
      </div>
    </div>
  )
}

export function Footer({ onSignOut }: { onSignOut?: () => void }) {
  return (
    <footer className="footer">
      <div className="container row row--between">
        <span className="brand">
          <LogoMark /> Nook
        </span>
        <div className="row" style={{ gap: 20 }}>
          <span>Book data from Open Library &amp; Google Books</span>
          <ThemeSelect />
          {onSignOut && (
            <button className="link" style={{ color: 'inherit' }} onClick={onSignOut}>
              Sign out
            </button>
          )}
        </div>
      </div>
    </footer>
  )
}

/** Renders children for signed-in users; sends everyone else to the welcome page. */
export function RequireAuth() {
  const { data: me, isLoading } = useMe()
  const location = useLocation()
  if (isLoading) return <Spinner />
  if (!me) return <Navigate to="/welcome" replace state={{ from: location.pathname }} />
  return <AppLayout />
}

/** Public pages (welcome, sign in) bounce signed-in users to their home. */
export function PublicOnly() {
  const { data: me, isLoading } = useMe()
  if (isLoading) return <Spinner />
  if (me) return <Navigate to="/" replace />
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  )
}
