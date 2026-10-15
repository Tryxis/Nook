import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  useDeleteBookmark,
  useDeleteRead,
  useEntry,
  useRemoveEntry,
  useSaveBookmark,
  useSaveRead,
  useSetShelves,
  useShelves,
  useUpdateEntry,
  useUpdateProgress,
  type ReadInput,
} from '../api/hooks'
import type { BookFormat, Bookmark, ReadThrough, UpdateUserBook, UserBookDetail } from '../api/types'
import { FORMATS, FORMAT_LABEL, STATUSES, STATUS_LABEL, isListenOnly } from '../api/types'
import { ShareDialog } from '../components/ShareDialog'
import {
  Cover,
  Field,
  FormatIcon,
  HeartIcon,
  Modal,
  ShareIcon,
  Spinner,
  StarInput,
  formatDate,
  toast,
  todayIso,
} from '../components/ui'

export function BookPage() {
  const { id = '' } = useParams()
  const { data: entry, isLoading, isError } = useEntry(id)

  if (isLoading) return <Spinner />
  if (isError || !entry)
    return (
      <div className="container empty">
        <h1 className="h1">Book not found.</h1>
        <Link to="/library" className="btn btn--dark">
          Back to your library
        </Link>
      </div>
    )
  return <BookView entry={entry} />
}

function BookView({ entry }: { entry: UserBookDetail }) {
  const update = useUpdateEntry(entry.id)
  const [shareOpen, setShareOpen] = useState(false)
  const book = entry.book

  // Every quick control (status, stars, heart, formats) sends the full editable state.
  const save = (patch: Partial<UpdateUserBook>, message?: string) =>
    update.mutate(
      {
        status: entry.status,
        formats: entry.formats,
        rating: entry.rating,
        review: entry.review,
        isFavorite: entry.isFavorite,
        currentPage: entry.currentPage,
        ...patch,
      },
      {
        onSuccess: () => message && toast(message),
        onError: (e) => toast((e as Error).message),
      },
    )

  return (
    <>
      <section className="band band--hero">
        <div className="container book-hero">
          <Cover src={book.coverUrl} title={book.title} author={book.authors[0]} eager />
          <div className="stack stack--lg">
            <div className="stack" style={{ gap: 12 }}>
              <h1 className="h1" style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}>
                {book.title}
              </h1>
              {book.subtitle && <p className="h3" style={{ color: 'var(--hero-soft)', fontWeight: 400 }}>{book.subtitle}</p>}
              <p className="lede" style={{ color: 'var(--hero-soft)', maxWidth: 'none' }}>
                {book.authors.join(', ') || 'Unknown author'}
              </p>
              <p className="small muted" style={{ margin: 0 }}>
                {[book.publishedYear, book.pageCount && `${book.pageCount} pages`, book.publisher].filter(Boolean).join(' · ')}
              </p>
            </div>

            <div className="chips" role="group" aria-label="Reading status">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  className="chip chip--hero"
                  aria-pressed={entry.status === s}
                  onClick={() => entry.status !== s && save({ status: s }, `Marked as ${STATUS_LABEL[s].toLowerCase()}`)}
                  disabled={update.isPending}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            <StarInput value={entry.rating} onChange={(rating) => save({ rating }, rating ? 'Rating saved' : 'Rating cleared')} onDark />

            <div className="row" role="group" aria-label="How you're reading it">
              {FORMATS.map((f) => {
                const on = entry.formats.includes(f)
                return (
                  <button
                    key={f}
                    className="format-toggle"
                    aria-pressed={on}
                    title={on ? `Remove ${FORMAT_LABEL[f].toLowerCase()}` : `Mark as ${FORMAT_LABEL[f].toLowerCase()}`}
                    onClick={() => save({ formats: toggleFormat(entry.formats, f) })}
                  >
                    <FormatIcon format={f} />
                    <span className="format-toggle__label">{FORMAT_LABEL[f]}</span>
                  </button>
                )
              })}
              <button
                className="btn btn--ghost btn--icon"
                aria-pressed={entry.isFavorite}
                aria-label={entry.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                title={entry.isFavorite ? 'Favourite' : 'Add to favourites'}
                onClick={() => save({ isFavorite: !entry.isFavorite })}
                style={{ width: 52, height: 52, color: entry.isFavorite ? 'var(--heart)' : 'var(--hero-ink)' }}
              >
                <HeartIcon filled={entry.isFavorite} />
              </button>
            </div>

            <div>
              <button className="btn btn--white" onClick={() => setShareOpen(true)}>
                <ShareIcon /> Share to Instagram
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="band band--cream">
        <div className="container detail-grid">
          <div className="stack stack--lg">
            <ReviewCard entry={entry} onSave={(review) => save({ review }, review ? 'Review saved' : 'Review removed')} saving={update.isPending} />
            {book.description && <About text={book.description} />}
            <BookmarksCard entry={entry} />
          </div>
          <div className="stack stack--lg">
            <ProgressCard entry={entry} />
            <ReadsCard entry={entry} />
            <ShelvesCard entry={entry} />
            <DangerZone entry={entry} />
          </div>
        </div>
      </section>

      <ShareDialog entry={entry} open={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  )
}

/** Formats combine freely: a book can be read in print and listened to as well. */
function toggleFormat(current: BookFormat[], f: BookFormat): BookFormat[] {
  return current.includes(f) ? current.filter((x) => x !== f) : FORMATS.filter((x) => x === f || current.includes(x))
}

// ---- Review ----

function ReviewCard({ entry, onSave, saving }: { entry: UserBookDetail; onSave: (r: string | null) => void; saving: boolean }) {
  const [draft, setDraft] = useState(entry.review ?? '')
  const [editing, setEditing] = useState(!entry.review)
  useEffect(() => {
    setDraft(entry.review ?? '')
    setEditing(!entry.review)
  }, [entry.review])

  const dirty = draft.trim() !== (entry.review ?? '')

  return (
    <div className="card card--white stack">
      <div className="row row--between">
        <h2 className="h2">Your review</h2>
        {!editing && (
          <button className="link small" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            onSave(draft.trim() || null)
          }}
        >
          <label className="sr-only" htmlFor="review">
            Review
          </label>
          <textarea
            id="review"
            className="textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={10000}
            placeholder="What did you think? What will you remember?"
          />
          <div className="row row--between">
            <span className="caption muted">{draft.length > 0 ? `${draft.length.toLocaleString()} characters` : ''}</span>
            <div className="row" style={{ gap: 8 }}>
              {entry.review && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setDraft(entry.review ?? ''); setEditing(false) }}>
                  Cancel
                </button>
              )}
              <button className="btn btn--dark btn--sm" disabled={!dirty || saving}>
                Save review
              </button>
            </div>
          </div>
        </form>
      ) : (
        <>
          <p style={{ margin: 0, whiteSpace: 'pre-line', fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1.45, color: 'var(--ink)', letterSpacing: 0 }}>
            {entry.review}
          </p>
          {entry.reviewUpdatedAt && <span className="caption muted">Written {formatDate(entry.reviewUpdatedAt)}</span>}
        </>
      )}
    </div>
  )
}

function About({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 420
  return (
    <div className="card card--white stack">
      <h2 className="h2">About the book</h2>
      <p className={`description small ${long && !open ? 'description--clamped' : ''}`} style={{ margin: 0 }}>
        {text}
      </p>
      {long && (
        <button className="link small" style={{ alignSelf: 'start' }} onClick={() => setOpen((o) => !o)}>
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}

// ---- Progress ----

function ProgressCard({ entry }: { entry: UserBookDetail }) {
  const progress = useUpdateProgress(entry.id)
  const [page, setPage] = useState(entry.currentPage?.toString() ?? '')
  useEffect(() => {
    setPage(entry.currentPage?.toString() ?? '')
  }, [entry.currentPage])
  const pages = entry.book.pageCount
  const pct = pages && entry.currentPage ? Math.min(100, Math.round((entry.currentPage / pages) * 100)) : 0

  return (
    <div className="card card--white stack">
      <h2 className="h2">Progress</h2>
      {isListenOnly(entry.formats) && (
        <p className="caption muted" style={{ margin: '-8px 0 0' }}>
          Listening? Log progress as the equivalent page, or use percentage bookmarks.
        </p>
      )}
      {pages ? (
        <div className="stack" style={{ gap: 6 }}>
          <div className="progress">
            <span style={{ width: `${pct}%` }} />
          </div>
          <span className="caption muted">
            {pct}% · {entry.currentPage ?? 0} of {pages} pages
          </span>
        </div>
      ) : null}
      <form
        className="row"
        style={{ gap: 8, flexWrap: 'nowrap' }}
        onSubmit={(e) => {
          e.preventDefault()
          const n = page === '' ? null : parseInt(page, 10)
          progress.mutate(n, { onSuccess: () => toast('Progress saved') })
        }}
      >
        <label className="sr-only" htmlFor="page">
          Current page
        </label>
        <input id="page" className="input" inputMode="numeric" placeholder="Current page" value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, ''))} />
        <button className="btn btn--dark btn--sm" disabled={progress.isPending || page === (entry.currentPage?.toString() ?? '')}>
          Save
        </button>
      </form>
    </div>
  )
}

// ---- Read-throughs ----

function ReadsCard({ entry }: { entry: UserBookDetail }) {
  const saveRead = useSaveRead(entry.id)
  const deleteRead = useDeleteRead(entry.id)
  const [editing, setEditing] = useState<ReadThrough | 'new' | null>(null)

  return (
    <div className="card card--white stack">
      <div className="row row--between">
        <h2 className="h2">Reading dates</h2>
        <button className="link small" onClick={() => setEditing('new')}>
          Add a read
        </button>
      </div>
      {entry.readThroughs.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>
          Dates are filled in when you start or finish. You can also add past reads.
        </p>
      ) : (
        <div>
          {entry.readThroughs.map((r, i) => (
            <div key={r.id} className="row row--between" style={{ padding: '10px 0', borderBottom: i < entry.readThroughs.length - 1 ? '1px solid var(--line)' : 0 }}>
              <div className="stack" style={{ gap: 2 }}>
                <span className="small" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                  {r.startedOn ? formatDate(r.startedOn) : 'Start unknown'} → {r.finishedOn ? formatDate(r.finishedOn) : 'reading now'}
                </span>
                <span className="caption muted">
                  {r.abandoned ? 'Did not finish' : r.finishedOn && r.startedOn ? daysBetween(r.startedOn, r.finishedOn) : ''}
                </span>
              </div>
              <button className="link small" onClick={() => setEditing(r)}>
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add a read' : 'Edit dates'}>
        {editing !== null && (
          <ReadForm
            initial={editing === 'new' ? null : editing}
            pending={saveRead.isPending || deleteRead.isPending}
            error={(saveRead.error as Error | null)?.message}
            onSubmit={(input) =>
              saveRead.mutate(
                { ...input, readId: editing === 'new' ? undefined : editing.id },
                { onSuccess: () => { setEditing(null); toast('Dates saved') } },
              )
            }
            onDelete={
              editing === 'new'
                ? undefined
                : () => deleteRead.mutate(editing.id, { onSuccess: () => { setEditing(null); toast('Read removed') } })
            }
          />
        )}
      </Modal>
    </div>
  )
}

function daysBetween(a: string, b: string) {
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1
  return `${d} ${d === 1 ? 'day' : 'days'}`
}

function ReadForm({
  initial,
  onSubmit,
  onDelete,
  pending,
  error,
}: {
  initial: ReadThrough | null
  onSubmit: (r: ReadInput) => void
  onDelete?: () => void
  pending: boolean
  error?: string
}) {
  const [startedOn, setStarted] = useState(initial?.startedOn ?? '')
  const [finishedOn, setFinished] = useState(initial?.finishedOn ?? '')
  const [abandoned, setAbandoned] = useState(initial?.abandoned ?? false)
  const today = todayIso()

  return (
    <form
      className="stack stack--lg"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ startedOn: startedOn || null, finishedOn: finishedOn || null, abandoned })
      }}
    >
      {error && <div className="alert">{error}</div>}
      <div className="row" style={{ alignItems: 'start' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <Field label="Started">
            <input className="input" type="date" max={today} value={startedOn} onChange={(e) => setStarted(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <Field label="Finished">
            <input className="input" type="date" max={today} min={startedOn || undefined} value={finishedOn} onChange={(e) => setFinished(e.target.value)} />
          </Field>
        </div>
      </div>
      <label className="row" style={{ gap: 10 }}>
        <input type="checkbox" checked={abandoned} onChange={(e) => setAbandoned(e.target.checked)} disabled={!finishedOn} />
        <span className="small">I stopped reading (did not finish)</span>
      </label>
      <div className="row row--between">
        {onDelete ? (
          <button type="button" className="btn btn--danger btn--sm" onClick={onDelete} disabled={pending}>
            Delete read
          </button>
        ) : (
          <span />
        )}
        <button className="btn btn--dark" disabled={pending || (!startedOn && !finishedOn)}>
          Save dates
        </button>
      </div>
    </form>
  )
}

// ---- Bookmarks ----

function BookmarksCard({ entry }: { entry: UserBookDetail }) {
  const saveBm = useSaveBookmark(entry.id)
  const deleteBm = useDeleteBookmark(entry.id)
  const [editing, setEditing] = useState<Bookmark | null>(null)
  const [mode, setMode] = useState<'page' | 'percent'>(entry.formats.length === 0 || entry.formats.includes('Print') ? 'page' : 'percent')
  const [pos, setPos] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (editing) {
      setMode(editing.page != null || editing.percent == null ? 'page' : 'percent')
      setPos((editing.page ?? editing.percent ?? '').toString())
      setNote(editing.note ?? '')
    }
  }, [editing])

  const reset = () => {
    setEditing(null)
    setPos('')
    setNote('')
  }

  const submit = () => {
    const n = pos === '' ? null : Number(pos)
    saveBm.mutate(
      {
        bookmarkId: editing?.id,
        page: mode === 'page' ? n : null,
        percent: mode === 'percent' ? n : null,
        note: note.trim() || null,
      },
      { onSuccess: () => { reset(); toast('Bookmark saved') }, onError: (e) => toast((e as Error).message) },
    )
  }

  return (
    <div className="card card--white stack">
      <h2 className="h2">Bookmarks</h2>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
          <select className="select" style={{ width: 'auto' }} value={mode} onChange={(e) => setMode(e.target.value as 'page' | 'percent')} aria-label="Bookmark by">
            <option value="page">Page</option>
            <option value="percent">%</option>
          </select>
          <input
            className="input"
            inputMode="decimal"
            placeholder={mode === 'page' ? 'Page number' : 'Percent through'}
            value={pos}
            onChange={(e) => setPos(e.target.value.replace(mode === 'page' ? /\D/g : /[^\d.]/g, ''))}
            aria-label={mode === 'page' ? 'Page number' : 'Percent through'}
            style={{ maxWidth: 160 }}
          />
        </div>
        <textarea className="textarea" style={{ minHeight: 80 }} placeholder="A line you loved, a thought, a question… (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} aria-label="Bookmark note" />
        <div className="row" style={{ justifyContent: 'end', gap: 8 }}>
          {editing && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>
              Cancel
            </button>
          )}
          <button className="btn btn--dark btn--sm" disabled={saveBm.isPending || (!pos && !note.trim())}>
            {editing ? 'Update bookmark' : 'Add bookmark'}
          </button>
        </div>
      </form>

      {entry.bookmarks.length > 0 && (
        <div>
          {entry.bookmarks.map((b) => (
            <div key={b.id} style={{ padding: '14px 0', borderTop: '1px solid var(--line)' }} className="stack">
              <div className="row row--between">
                <span className="tag" style={{ background: 'var(--primary-bg)', color: 'var(--primary-ink)' }}>
                  {b.page != null ? `p. ${b.page}` : b.percent != null ? `${b.percent}%` : 'Note'}
                </span>
                <div className="row" style={{ gap: 14 }}>
                  <span className="caption muted">{formatDate(b.createdAt)}</span>
                  <button className="link caption" onClick={() => setEditing(b)}>
                    Edit
                  </button>
                  <button className="link caption" style={{ color: 'var(--danger)' }} onClick={() => deleteBm.mutate(b.id)} disabled={deleteBm.isPending}>
                    Delete
                  </button>
                </div>
              </div>
              {b.note && (
                <p className="small" style={{ margin: 0, whiteSpace: 'pre-line' }}>
                  {b.note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Shelves ----

function ShelvesCard({ entry }: { entry: UserBookDetail }) {
  const shelves = useShelves()
  const setShelves = useSetShelves(entry.id)
  const current = new Set(entry.shelves.map((s) => s.id))

  const toggle = (id: string) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setShelves.mutate([...next])
  }

  return (
    <div className="card card--white stack">
      <div className="row row--between">
        <h2 className="h2">Shelves</h2>
        <Link to="/shelves" className="link small">
          Manage
        </Link>
      </div>
      {shelves.data?.length ? (
        <div className="chips">
          {shelves.data.map((s) => (
            <button key={s.id} className="chip" aria-pressed={current.has(s.id)} onClick={() => toggle(s.id)} disabled={setShelves.isPending}>
              {current.has(s.id) ? '✓ ' : '+ '}
              {s.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          No shelves yet. <Link to="/shelves" className="link">Create one</Link> to group books like “Book club” or “Comfort reads”.
        </p>
      )}
    </div>
  )
}

function DangerZone({ entry }: { entry: UserBookDetail }) {
  const remove = useRemoveEntry()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="stack" style={{ alignItems: 'start' }}>
      <span className="caption muted">Added {formatDate(entry.addedAt)}</span>
      <button className="link small" style={{ color: 'var(--danger)' }} onClick={() => setConfirm(true)}>
        Remove from library
      </button>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Remove this book?">
        <div className="stack stack--lg">
          <p style={{ margin: 0 }}>
            This deletes your rating, review, reading dates and bookmarks for <strong>{entry.book.title}</strong>. It can't be undone.
          </p>
          <div className="row" style={{ justifyContent: 'end' }}>
            <button className="btn btn--ghost btn--sm" onClick={() => setConfirm(false)}>
              Keep it
            </button>
            <button
              className="btn btn--dark btn--sm"
              style={{ background: 'var(--danger)', color: 'var(--page-bg)' }}
              disabled={remove.isPending}
              onClick={() => remove.mutate(entry.id, { onSuccess: () => { toast('Removed from your library'); navigate('/library') } })}
            >
              Remove
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
