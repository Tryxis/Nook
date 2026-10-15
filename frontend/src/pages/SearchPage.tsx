import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAddToLibrary, useLibraryLookup, useSearch } from '../api/hooks'
import type { ReadingStatus, SearchResult } from '../api/types'
import { STATUSES, STATUS_LABEL } from '../api/types'
import { TileSkeletons } from '../components/BookTile'
import { Cover, SearchIcon, toast } from '../components/ui'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [text, setText] = useState(q)

  // Debounce typing into the URL (which drives the query) so we don't search on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      if (text.trim() !== q) setParams(text.trim() ? { q: text.trim() } : {}, { replace: true })
    }, 400)
    return () => clearTimeout(t)
  }, [text, q, setParams])

  const search = useSearch(q)
  const results = search.data ?? []
  const ids = useMemo(() => results.map((r) => r.id), [results])
  const owned = useLibraryLookup(ids).data ?? {}

  return (
    <>
      <section className="band band--hero">
        <div className="container stack stack--lg">
          <h1 className="display">Find a book.</h1>
          <form
            className="search-input"
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              setParams(text.trim() ? { q: text.trim() } : {})
            }}
          >
            <SearchIcon />
            <label htmlFor="q" className="sr-only">
              Title, author or ISBN
            </label>
            <input
              id="q"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Title, author or ISBN"
              autoComplete="off"
            />
            <button className="btn btn--dark btn--sm" type="submit">
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="band band--cream" style={{ minHeight: 400 }}>
        <div className="container">
          {q.length < 2 ? (
            <p className="muted">Search by title, author or ISBN. Results come from Open Library and Google Books.</p>
          ) : search.isError ? (
            <p className="muted">{(search.error as Error).message}</p>
          ) : search.isLoading ? (
            <div className="cover-grid">
              <TileSkeletons count={12} />
            </div>
          ) : results.length === 0 ? (
            <div className="empty">
              <h2 className="h2">Nothing found for “{q}”.</h2>
              <p className="muted">Try a shorter title, the author's surname, or the ISBN from the back cover.</p>
            </div>
          ) : (
            <>
              <p className="small muted" style={{ marginTop: 0, marginBottom: 24, opacity: search.isFetching ? 0.5 : 1 }}>
                {results.length} results for “{q}”
              </p>
              <div className="cover-grid cover-grid--results">
                {results.map((r) => (
                  <ResultTile key={r.id} result={r} ownedId={owned[r.id]} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  )
}

function ResultTile({ result, ownedId }: { result: SearchResult; ownedId?: string }) {
  const add = useAddToLibrary()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const author = result.authors[0] ?? 'Unknown author'

  const addAs = (status: ReadingStatus) => {
    setMenu(false)
    add.mutate(
      { resultId: result.id, status },
      {
        onSuccess: (entry) => {
          toast(`Added to ${STATUS_LABEL[status].toLowerCase()}`)
          if (status !== 'WantToRead') navigate(`/library/${entry.id}`)
        },
        onError: (e) => toast((e as Error).message),
      },
    )
  }

  return (
    <div className="tile">
      <Cover src={result.coverUrl} title={result.title} author={author} />
      <div className="stack" style={{ gap: 4 }}>
        <span className="tile__title">{result.title}</span>
        <span className="tile__author">
          {author}
          {result.publishedYear ? ` · ${result.publishedYear}` : ''}
        </span>
      </div>
      {ownedId ? (
        <Link to={`/library/${ownedId}`} className="btn btn--ghost btn--sm">
          In your library
        </Link>
      ) : (
        <div style={{ position: 'relative' }}>
          <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
            <button className="btn btn--dark btn--sm" style={{ flex: 1 }} onClick={() => addAs('WantToRead')} disabled={add.isPending}>
              {add.isPending ? 'Adding…' : 'Want to read'}
            </button>
            <button
              className="btn btn--ghost btn--sm"
              style={{ padding: '10px 12px' }}
              aria-label="More shelves"
              aria-expanded={menu}
              onClick={() => setMenu((m) => !m)}
              disabled={add.isPending}
            >
              ▾
            </button>
          </div>
          {menu && (
            <div className="card--raised" role="menu" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 10, borderRadius: 12, padding: 6 }}>
              {STATUSES.filter((s) => s !== 'WantToRead').map((s) => (
                <button key={s} role="menuitem" className="chip" style={{ display: 'block', width: '100%', textAlign: 'left', boxShadow: 'none', borderRadius: 8 }} onClick={() => addAs(s)}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
