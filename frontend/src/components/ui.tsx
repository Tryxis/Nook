import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { BookFormat, ReadingStatus } from '../api/types'
import { FORMAT_LABEL, STATUS_LABEL } from '../api/types'

// ---- Logo ----

export function LogoMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      {/* Inherits the surrounding text colour, so it works on any theme's nav/footer. */}
      <rect width="32" height="32" rx="8" fill="currentColor" fillOpacity="0.12" />
      <path d="M8 9.5c3-1 5.5-.7 8 1v13c-2.5-1.7-5-2-8-1z" fill="currentColor" fillOpacity="0.82" />
      <path d="M24 9.5c-3-1-5.5-.7-8 1v13c2.5-1.7 5-2 8-1z" fill="currentColor" />
      <path d="M19.5 9.6v6l1.5-1.2 1.5 1.2V9.4" fill="var(--logo-accent)" />
    </svg>
  )
}

// ---- Cover ----

export function Cover({
  src,
  title,
  author,
  className = '',
  eager = false,
}: {
  src: string | null | undefined
  title: string
  author?: string
  className?: string
  eager?: boolean
}) {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!src || failed) {
    return (
      <div className={`cover cover--blank ${className}`} role="img" aria-label={`${title} (no cover)`}>
        <span className="cover__title">{title}</span>
        {author && <span className="cover__author">{author}</span>}
      </div>
    )
  }
  return (
    <div className={`cover ${className}`}>
      <img src={src} alt={`Cover of ${title}`} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} />
    </div>
  )
}

// ---- Stars ----

const STAR_PATH =
  'M12 2.6l2.82 5.72 6.31.92-4.57 4.45 1.08 6.29L12 17.02l-5.64 2.96 1.08-6.29L2.87 9.24l6.31-.92L12 2.6z'

/** One star filled to `fill` (0, 0.5 or 1). */
function Star({ fill, size, empty, color }: { fill: number; size: number; empty: string; color: string }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <rect x="0" y="0" width={24 * fill} height="24" />
        </clipPath>
      </defs>
      <path d={STAR_PATH} fill={empty} />
      <path d={STAR_PATH} fill={color} clipPath={`url(#${id})`} />
    </svg>
  )
}

export function Stars({ value, size = 16, onDark = false }: { value: number | null; size?: number; onDark?: boolean }) {
  const v = value ?? 0
  const empty = onDark ? 'var(--star-empty-on-hero)' : 'var(--star-empty)'
  const color = onDark ? 'var(--star-on-hero)' : 'var(--star)'
  return (
    <span className="stars" role="img" aria-label={value ? `${formatRating(value)} out of 5 stars` : 'Not rated'}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} empty={empty} color={color} fill={v >= i ? 1 : v >= i - 0.5 ? 0.5 : 0} />
      ))}
    </span>
  )
}

export function formatRating(r: number) {
  return Number.isInteger(r) ? `${r}` : r.toFixed(1)
}

/**
 * Half-star rating input. Pointer position within a star picks the half; arrow keys step by 0.5;
 * choosing the current value again clears it.
 */
export function StarInput({
  value,
  onChange,
  size = 36,
  onDark = false,
}: {
  value: number | null
  onChange: (v: number | null) => void
  size?: number
  onDark?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const shown = hover ?? value ?? 0
  const empty = onDark ? 'var(--star-empty-on-hero)' : 'var(--star-empty)'
  const color = onDark ? 'var(--star-on-hero)' : 'var(--star)'

  const valueAt = (clientX: number) => {
    const el = ref.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width - 1)
    const raw = (x / rect.width) * 5
    return Math.max(0.5, Math.ceil(raw * 2) / 2)
  }

  const commit = (v: number | null) => onChange(v === value ? null : v)

  return (
    <div className="star-input">
      <div
        ref={ref}
        className="star-input__track"
        role="slider"
        tabIndex={0}
        aria-label="Your rating"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={value ?? 0}
        aria-valuetext={value ? `${formatRating(value)} stars` : 'Not rated'}
        onPointerMove={(e) => setHover(valueAt(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => commit(valueAt(e.clientX))}
        onKeyDown={(e) => {
          const cur = value ?? 0
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault()
            onChange(Math.min(5, cur + 0.5))
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault()
            onChange(cur - 0.5 <= 0 ? null : cur - 0.5)
          } else if (e.key === 'Delete' || e.key === 'Backspace' || e.key === '0') {
            onChange(null)
          }
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={size} empty={empty} color={color} fill={shown >= i ? 1 : shown >= i - 0.5 ? 0.5 : 0} />
        ))}
      </div>
      <span className="small" style={{ minWidth: 64 }}>
        {hover ? `${formatRating(hover)} / 5` : value ? `${formatRating(value)} / 5` : 'Not rated'}
      </span>
    </div>
  )
}

// ---- Status ----

export const STATUS_COLOR: Record<ReadingStatus, string> = {
  WantToRead: 'var(--status-want)',
  Reading: 'var(--status-reading)',
  Finished: 'var(--status-finished)',
  DidNotFinish: 'var(--status-dnf)',
}

export function StatusTag({ status }: { status: ReadingStatus }) {
  return (
    <span className="tag">
      <span className="status-dot" style={{ background: STATUS_COLOR[status] }} />
      {STATUS_LABEL[status]}
    </span>
  )
}

// ---- Modal ----

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`modal ${wide ? 'modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="row row--between" style={{ marginBottom: 20 }}>
          <h2 className="h2">{title}</h2>
          <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

// ---- Toast ----

let pushToast: ((msg: string) => void) | null = null

export function toast(msg: string) {
  pushToast?.(msg)
}

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    pushToast = (m) => {
      setMsg(m)
      clearTimeout(t)
      t = setTimeout(() => setMsg(null), 2600)
    }
    return () => {
      pushToast = null
      clearTimeout(t)
    }
  }, [])
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null
}

// ---- Misc ----

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {error && <span className="field__error">{error}</span>}
    </label>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="empty" aria-busy="true">
      <span className="muted">{label}…</span>
    </div>
  )
}

export function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function SearchIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

export function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7-4.4-9.2-9C1.4 8 3.3 4.5 6.8 4.5c2 0 3.5 1.1 4.2 2.5h2c.7-1.4 2.2-2.5 4.2-2.5 3.5 0 5.4 3.5 4 6.5C19 15.6 12 20 12 20z" />
    </svg>
  )
}

export function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 002 2h10a2 2 0 002-2v-5" />
    </svg>
  )
}

export function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

/** Small decorative star/circle accents in brand colours — a stand-in for illustration art. */
export function Confetti({ style }: { style?: CSSProperties }) {
  return (
    <svg className="confetti" style={style} width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
      <path d={STAR_PATH} transform="translate(8 6) scale(1.6)" fill="var(--confetti-a)" />
      <circle cx="96" cy="30" r="9" fill="var(--confetti-b)" />
      <circle cx="70" cy="96" r="6" fill="var(--confetti-c)" />
      <path d="M96 78v18M87 87h18" stroke="var(--confetti-d)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return ''
  // DateOnly values ("2026-10-15") must not shift across time zones.
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso)
  return d.toLocaleDateString(undefined, opts)
}

export function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---- Format icons ----

export function FormatIcon({ format, size = 20 }: { format: BookFormat; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (format) {
    case 'Print':
      return (
        <svg {...common}>
          <path d="M4 5.5c2.7-1 5.3-.8 8 1v13c-2.7-1.8-5.3-2-8-1z" />
          <path d="M20 5.5c-2.7-1-5.3-.8-8 1v13c2.7-1.8 5.3-2 8-1z" />
        </svg>
      )
    case 'Ebook':
      return (
        <svg {...common}>
          <rect x="6" y="2.5" width="12" height="19" rx="2" />
          <path d="M10 18h4" />
        </svg>
      )
    case 'Audiobook':
      return (
        <svg {...common}>
          <path d="M4 15v-3a8 8 0 0116 0v3" />
          <rect x="3" y="14" width="4.5" height="6.5" rx="1.5" />
          <rect x="16.5" y="14" width="4.5" height="6.5" rx="1.5" />
        </svg>
      )
  }
}

/** Small, muted row of format icons for tiles and lists. Renders nothing when no format is set. */
export function FormatIcons({ formats, size = 14 }: { formats: BookFormat[]; size?: number }) {
  if (!formats.length) return null
  return (
    <span className="format-icons" role="img" aria-label={formats.map((f) => FORMAT_LABEL[f]).join(' and ')}>
      {formats.map((f) => (
        <FormatIcon key={f} format={f} size={size} />
      ))}
    </span>
  )
}
