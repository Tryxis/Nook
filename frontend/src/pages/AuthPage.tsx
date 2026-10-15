import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useLogin, useRegister } from '../api/hooks'
import { GuestButton } from '../components/GuestButton'
import { Confetti, Field, LogoMark } from '../components/ui'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const login = useLogin()
  const register = useRegister()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  const isLogin = mode === 'login'
  const mutation = isLogin ? login : register
  const error = mutation.error instanceof ApiError ? mutation.error : null
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const done = { onSuccess: () => navigate(from, { replace: true }) }
    if (isLogin) login.mutate({ email, password }, done)
    else register.mutate({ email, password, displayName }, done)
  }

  return (
    <main className="band band--hero" style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', padding: '40px 0' }}>
      <Confetti style={{ top: 40, right: '12%' }} />
      <Confetti style={{ bottom: 40, left: '8%', transform: 'rotate(140deg)' }} />
      <div className="container stack stack--lg" style={{ alignItems: 'center' }}>
        <Link to="/welcome" className="brand">
          <LogoMark /> Nook
        </Link>
        <h1 className="h1" style={{ textAlign: 'center' }}>
          {isLogin ? 'Welcome back.' : 'Start your reading diary.'}
        </h1>

        <form className="form-card stack stack--lg" onSubmit={submit} noValidate>
          {error && !error.field('email') && !error.field('password') && <div className="alert">{error.message}</div>}

          {!isLogin && (
            <Field label="Your name" error={error?.field('displayName')}>
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="nickname"
                maxLength={60}
                required
              />
            </Field>
          )}
          <Field label="Email" error={error?.field('email')}>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Password" error={error?.field('password')}>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              minLength={8}
              required
            />
          </Field>
          {!isLogin && <p className="caption muted" style={{ margin: '-12px 0 0' }}>At least 8 characters, including a number.</p>}

          <button className="btn btn--dark" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'One moment…' : isLogin ? 'Sign in' : 'Create my diary'}
          </button>

          <div className="divider-text caption muted">or</div>
          <GuestButton className="btn btn--ghost" />
          <p className="caption muted" style={{ margin: '-12px 0 0', textAlign: 'center' }}>
            No sign-up needed. You'll get a sample library to explore; it's cleared after a day.
          </p>

          <p className="small" style={{ margin: 0, textAlign: 'center' }}>
            {isLogin ? (
              <>
                New here? <Link to="/register" className="link">Create an account</Link>
              </>
            ) : (
              <>
                Already have an account? <Link to="/login" className="link">Sign in</Link>
              </>
            )}
          </p>
        </form>
      </div>
    </main>
  )
}
