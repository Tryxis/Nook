import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useDeleteShelf, useSaveShelf, useShelves } from '../api/hooks'
import type { Shelf } from '../api/types'
import { Cover, Field, Modal, Spinner, toast } from '../components/ui'

export function ShelvesPage() {
  const shelves = useShelves()
  const [editing, setEditing] = useState<Shelf | 'new' | null>(null)

  return (
    <>
      <section className="band band--hero band--tight">
        <div className="container row row--between" style={{ alignItems: 'end' }}>
          <div className="stack">
            <h1 className="display">Shelves.</h1>
            <p className="lede" style={{ color: 'var(--hero-soft)' }}>
              Your own lists: book club picks, comfort reads, the 2026 pile.
            </p>
          </div>
          <button className="btn btn--white" onClick={() => setEditing('new')}>
            New shelf
          </button>
        </div>
      </section>

      <section className="band band--cream">
        <div className="container">
          {shelves.isLoading ? (
            <Spinner />
          ) : shelves.data?.length ? (
            <div className="cover-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24 }}>
              {shelves.data.map((s) => (
                <div key={s.id} className="card card--white stack">
                  <Link to={`/shelves/${s.id}`} style={{ textDecoration: 'none' }} className="stack">
                    <ShelfCollage shelf={s} />
                    <div className="stack" style={{ gap: 2 }}>
                      <span className="h3">{s.name}</span>
                      <span className="small muted">
                        {s.bookCount} {s.bookCount === 1 ? 'book' : 'books'}
                        {s.audiobookCount > 0 && ` · ${s.audiobookCount} ${s.audiobookCount === 1 ? 'audiobook' : 'audiobooks'}`}
                      </span>
                    </div>
                  </Link>
                  <div className="row" style={{ gap: 14 }}>
                    <button className="link small" onClick={() => setEditing(s)}>
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <h2 className="h2">No shelves yet.</h2>
              <p className="muted">Group books however you like. A book can sit on as many shelves as you want.</p>
              <button className="btn btn--dark" onClick={() => setEditing('new')}>
                Create your first shelf
              </button>
            </div>
          )}
        </div>
      </section>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New shelf' : 'Edit shelf'}>
        {editing !== null && <ShelfForm shelf={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  )
}

function ShelfCollage({ shelf }: { shelf: Shelf }) {
  const covers = shelf.coverUrls.slice(0, 4)
  return (
    <div style={{ display: 'flex', gap: 8, height: 132, alignItems: 'end' }}>
      {covers.length === 0 ? (
        <div className="cover" style={{ height: 132, width: 88, background: 'var(--fog)', boxShadow: 'none' }} />
      ) : (
        covers.map((url, i) => (
          <div key={url} style={{ width: 88 - i * 4, flex: 'none' }}>
            <Cover src={url} title={shelf.name} />
          </div>
        ))
      )}
    </div>
  )
}

function ShelfForm({ shelf, onDone }: { shelf: Shelf | null; onDone: () => void }) {
  const save = useSaveShelf()
  const del = useDeleteShelf()
  const [name, setName] = useState(shelf?.name ?? '')
  const [description, setDescription] = useState(shelf?.description ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const error = save.error instanceof ApiError ? save.error : null

  return (
    <form
      className="stack stack--lg"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate(
          { id: shelf?.id, name: name.trim(), description: description.trim() || null },
          { onSuccess: () => { toast(shelf ? 'Shelf updated' : 'Shelf created'); onDone() } },
        )
      }}
    >
      <Field label="Name" error={error?.field('name') ?? (error && !error.field('description') ? error.message : undefined)}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
      </Field>
      <Field label="Description (optional)" error={error?.field('description')}>
        <textarea className="textarea" style={{ minHeight: 90 }} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      </Field>
      <div className="row row--between">
        {shelf ? (
          confirmDelete ? (
            <button
              type="button"
              className="btn btn--danger btn--sm"
              disabled={del.isPending}
              onClick={() => del.mutate(shelf.id, { onSuccess: () => { toast('Shelf deleted'); onDone() } })}
            >
              Really delete? Books stay in your library
            </button>
          ) : (
            <button type="button" className="link small" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete(true)}>
              Delete shelf
            </button>
          )
        ) : (
          <span />
        )}
        <button className="btn btn--dark" disabled={save.isPending || !name.trim()}>
          {shelf ? 'Save' : 'Create shelf'}
        </button>
      </div>
    </form>
  )
}
