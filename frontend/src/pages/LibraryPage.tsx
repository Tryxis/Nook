import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useLibrary, useShelves, type LibraryFilter } from '../api/hooks'
import type { BookFormat, ReadingStatus } from '../api/types'
import { FORMATS, FORMAT_LABEL, STATUSES, STATUS_LABEL } from '../api/types'
import { BookTile, TileSkeletons } from '../components/BookTile'
import { FormatIcon, SearchIcon } from '../components/ui'

const SORTS: { value: NonNullable<LibraryFilter['sort']>; label: string }[] = [
  { value: 'recent', label: 'Recently updated' },
  { value: 'finished', label: 'Date finished' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'rating', label: 'Rating' },
]

export function LibraryPage() {
  const { shelfId } = useParams()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as ReadingStatus | null) ?? undefined
  const sort = (params.get('sort') as LibraryFilter['sort']) ?? 'recent'
  const favorites = params.get('favorites') === 'true'
  const format = (params.get('format') as BookFormat | null) ?? undefined
  const [q, setQ] = useState('')

  const shelves = useShelves()
  const shelf = shelves.data?.find((s) => s.id === shelfId)
  const library = useLibrary({ status, shelfId, sort, favorites, format, q: q.trim() || undefined })

  const set = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <>
      <section className="band band--hero band--tight">
        <div className="container stack">
          {shelfId && (
            <Link to="/shelves" className="link small" style={{ color: 'var(--hero-soft)' }}>
              ← All shelves
            </Link>
          )}
          <h1 className="display">{shelfId ? shelf?.name ?? 'Shelf' : 'Your library.'}</h1>
          {shelf?.description && <p className="lede" style={{ color: 'var(--hero-soft)' }}>{shelf.description}</p>}
        </div>
      </section>

      <section className="band band--cream" style={{ paddingTop: 40 }}>
        <div className="container stack stack--lg">
          <div className="row row--between" style={{ alignItems: 'start' }}>
            <div className="chips" role="group" aria-label="Filter by status">
              <button className="chip" aria-pressed={!status && !favorites && !format} onClick={() => setParams({}, { replace: true })}>
                All
              </button>
              {STATUSES.map((s) => (
                <button key={s} className="chip" aria-pressed={status === s} onClick={() => set('status', status === s ? undefined : s)}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
              <button className="chip" aria-pressed={favorites} onClick={() => set('favorites', favorites ? undefined : 'true')}>
                ♥ Favourites
              </button>
              {FORMATS.map((f) => (
                <button key={f} className="chip chip--icon" aria-pressed={format === f} onClick={() => set('format', format === f ? undefined : f)}>
                  <FormatIcon format={f} size={16} /> {FORMAT_LABEL[f]}
                </button>
              ))}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <label className="search-input" style={{ padding: '4px 16px', boxShadow: 'none', minWidth: 200 }}>
                <SearchIcon size={16} />
                <span className="sr-only">Filter your library</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by title or author" style={{ fontSize: 15, padding: '6px 0' }} />
              </label>
              <label className="sr-only" htmlFor="sort">
                Sort by
              </label>
              <select id="sort" className="select" style={{ width: 'auto', borderRadius: 60, padding: '10px 16px' }} value={sort} onChange={(e) => set('sort', e.target.value)}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {library.isLoading ? (
            <div className="cover-grid">
              <TileSkeletons count={12} />
            </div>
          ) : library.data?.length ? (
            <>
              <p className="small muted" style={{ margin: 0 }}>
                {library.data.length} {library.data.length === 1 ? 'book' : 'books'}
              </p>
              <div className="cover-grid">
                {library.data.map((e) => (
                  <BookTile key={e.id} entry={e} showStatus={!status} />
                ))}
              </div>
            </>
          ) : (
            <div className="empty">
              <h2 className="h2">{q || status || favorites || format ? 'No books match.' : shelfId ? 'This shelf is empty.' : 'No books yet.'}</h2>
              <p className="muted">
                {shelfId ? 'Add books to this shelf from their page.' : 'Search for a book to start your library.'}
              </p>
              <Link to="/search" className="btn btn--dark">
                Find a book
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
