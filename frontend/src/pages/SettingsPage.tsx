import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useChangePassword, useLogout, useMe, useUpdateProfile } from '../api/hooks'
import { ThemePicker } from '../components/ThemePicker'
import { Field, toast } from '../components/ui'

export function SettingsPage() {
  const { data: me } = useMe()
  const update = useUpdateProfile()
  const logout = useLogout()
  const navigate = useNavigate()
  const [name, setName] = useState(me?.displayName ?? '')
  const [goal, setGoal] = useState(me?.yearlyGoal?.toString() ?? '')

  return (
    <>
      <section className="band band--hero band--tight">
        <div className="container">
          <h1 className="display">Settings.</h1>
        </div>
      </section>
      <section className="band band--cream">
        <div className="container stack stack--lg" style={{ maxWidth: 760 }}>
          <div className="card card--white stack">
            <h2 className="h2">Appearance</h2>
            <p className="small muted" style={{ margin: 0 }}>
              Changes the colours across the whole site. Saved on this device.
            </p>
            <ThemePicker />
          </div>
          <form
            className="card card--white stack stack--lg"
            onSubmit={(e) => {
              e.preventDefault()
              update.mutate(
                { displayName: name.trim(), yearlyGoal: goal ? parseInt(goal, 10) : null },
                { onSuccess: () => toast('Settings saved'), onError: (err) => toast((err as Error).message) },
              )
            }}
          >
            <Field label="Display name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
            </Field>
            <Field label={`Reading goal for ${new Date().getFullYear()} (books)`}>
              <input className="input" inputMode="numeric" placeholder="e.g. 24" value={goal} onChange={(e) => setGoal(e.target.value.replace(/\D/g, '').slice(0, 4))} />
            </Field>
            <p className="caption muted" style={{ margin: '-8px 0 0' }}>
              {me?.isGuest ? 'You are using a temporary guest account. It and everything in it is deleted within a day.' : `Signed in as ${me?.email}`}
            </p>
            <div className="row row--between">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/welcome') })}>
                Sign out
              </button>
              <button className="btn btn--dark" disabled={update.isPending || !name.trim()}>
                Save
              </button>
            </div>
          </form>

          {me && !me.isGuest && <PasswordCard />}
        </div>
      </section>
    </>
  )
}

function PasswordCard() {
  const change = useChangePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const error = change.error instanceof ApiError ? change.error : null
  const mismatch = confirm.length > 0 && next !== confirm

  return (
    <form
      className="card card--white stack stack--lg"
      onSubmit={(e) => {
        e.preventDefault()
        if (mismatch) return
        change.mutate(
          { currentPassword: current, newPassword: next },
          {
            onSuccess: () => {
              setCurrent('')
              setNext('')
              setConfirm('')
              toast('Password changed. Other devices have been signed out.')
            },
          },
        )
      }}
    >
      <h2 className="h2">Password</h2>
      <Field label="Current password" error={error?.field('currentPassword')}>
        <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </Field>
      <Field label="New password" error={error?.field('newPassword')}>
        <input className="input" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
      </Field>
      <Field label="Confirm new password" error={mismatch ? "Passwords don't match." : undefined}>
        <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      <p className="caption muted" style={{ margin: '-12px 0 0' }}>
        At least 8 characters, including a number.
      </p>
      {error && !error.field('currentPassword') && !error.field('newPassword') && <div className="alert">{error.message}</div>}
      <div className="row" style={{ justifyContent: 'end' }}>
        <button className="btn btn--dark" disabled={change.isPending || !current || next.length < 8 || mismatch}>
          {change.isPending ? 'Changing…' : 'Change password'}
        </button>
      </div>
    </form>
  )
}
