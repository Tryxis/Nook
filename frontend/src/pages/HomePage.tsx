import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLibrary, useMe, useStats, useUpdateProgress } from '../api/hooks'
import type { UserBookSummary } from '../api/types'
import { BookTile, TileSkeletons } from '../components/BookTile'
import { Confetti, Cover, FormatIcons, SearchIcon, toast } from '../components/ui'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function HomePage() {
  const { data: me } = useMe()
  const reading = useLibrary({ status: 'Reading' })
  const upNext = useLibrary({ status: 'WantToRead' })
  const finished = useLibrary({ status: 'Finished', sort: 'finished' })
  const year = new Date().getFullYear()
  const stats = useStats(year)

  const isEmpty =
    reading.data?.length === 0 && upNext.data?.length === 0 && finished.data?.length === 0

  return (
    <>
      <section className="band band--hero" style={{ position: 'relative', overflow: 'hidden' }}>
        <Confetti style={{ top: 24, right: '6%' }} />
        <div className="container stack stack--lg">
          <p className="eyebrow">{greeting()}, {me?.displayName}</p>
          <h1 className="display" style={{ maxWidth: 760 }}>
            {reading.data?.length ? 'Pick up where you left off.' : 'What are you reading next?'}
          </h1>

          {isEmpty ? (
            <div className="stack" style={{ maxWidth: 520 }}>
              <p className="lede" style={{ color: 'var(--hero-soft)' }}>
                Your diary is empty. Find a book you're reading, or one you've loved, and add it to get started.
              </p>
              <div>
                <Link to="/search" className="btn btn--white">
                  <SearchIcon size={18} /> Find a book
                </Link>
              </div>
            </div>
          ) : (
            <div className="stack" style={{ gap: 0, marginTop: 8 }}>
              {reading.data?.map((e) => <CurrentlyReading key={e.id} entry={e} />)}
              {reading.data?.length === 0 && (
                <div className="row">
                  <Link to="/search" className="btn btn--white">
                    <SearchIcon size={18} /> Find a book
                  </Link>
                </div>
              )}
            </div>
          )}

          {stats.data?.goal && (
            <div className="stack" style={{ gap: 8, maxWidth: 420, marginTop: 16 }}>
              <div className="row row--between small">
                <span>{year} goal</span>
                <span>
                  {stats.data.booksFinished} / {stats.data.goal} books
                </span>
              </div>
              <div className="progress">
                <span style={{ width: `${Math.min(100, (stats.data.booksFinished / stats.data.goal) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
      </section>

      <Shelfrow title="Up next" empty="Books you want to read will wait here." items={upNext.data} loading={upNext.isLoading} band="cream" link="/library?status=WantToRead" />
      <Shelfrow title="Recently finished" empty="Books you finish will show up here." items={finished.data} loading={finished.isLoading} band="white" link="/library?status=Finished" />
    </>
  )
}

function CurrentlyReading({ entry }: { entry: UserBookSummary }) {
  const update = useUpdateProgress(entry.id)
  const [page, setPage] = useState(entry.currentPage?.toString() ?? '')
  const pages = entry.book.pageCount
  const pct = pages && entry.currentPage ? Math.min(100, Math.round((entry.currentPage / pages) * 100)) : null

  const save = () => {
    const n = page === '' ? null : Math.max(0, parseInt(page, 10))
    if (n === entry.currentPage || Number.isNaN(n)) return
    update.mutate(n, { onSuccess: () => toast('Progress saved') })
  }

  return (
    <div className="list-row reading-row" style={{ borderColor: 'var(--hero-line)' }}>
      <Link to={`/library/${entry.id}`}>
        <Cover src={entry.book.coverUrl} title={entry.book.title} />
      </Link>
      <div className="stack" style={{ gap: 6, minWidth: 0 }}>
        <Link to={`/library/${entry.id}`} style={{ textDecoration: 'none' }}>
          <span className="h3">{entry.book.title}</span>
        </Link>
        <span className="small muted row" style={{ gap: 8 }}>
          {entry.book.authors.join(', ')} <FormatIcons formats={entry.formats} />
        </span>
        {pct != null && (
          <div className="stack" style={{ gap: 4, maxWidth: 360 }}>
            <div className="progress">
              <span style={{ width: `${pct}%` }} />
            </div>
            <span className="caption muted">
              {pct}% · page {entry.currentPage} of {pages}
            </span>
          </div>
        )}
      </div>
      <form
        className="row reading-row__form"
        style={{ gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <label className="sr-only" htmlFor={`page-${entry.id}`}>
          Current page
        </label>
        <input
          id={`page-${entry.id}`}
          className="input"
          inputMode="numeric"
          placeholder="Page"
          value={page}
          onChange={(e) => setPage(e.target.value.replace(/\D/g, ''))}
          style={{ width: 92, borderRadius: 60, padding: '10px 14px' }}
        />
        <button className="btn btn--white btn--sm" disabled={update.isPending}>
          Update
        </button>
      </form>
    </div>
  )
}

function Shelfrow({
  title,
  items,
  loading,
  empty,
  band,
  link,
}: {
  title: string
  items: UserBookSummary[] | undefined
  loading: boolean
  empty: string
  band: 'cream' | 'white'
  link: string
}) {
  return (
    <section className={`band band--${band}`}>
      <div className="container">
        <div className="section-head">
          <h2 className="h1">{title}</h2>
          {!!items?.length && (
            <Link to={link} className="link">
              See all
            </Link>
          )}
        </div>
        {loading ? (
          <div className="cover-row">
            <TileSkeletons />
          </div>
        ) : items?.length ? (
          <div className="cover-row">
            {items.slice(0, 12).map((e) => (
              <BookTile key={e.id} entry={e} />
            ))}
          </div>
        ) : (
          <p className="muted">{empty}</p>
        )}
      </div>
    </section>
  )
}
