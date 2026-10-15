import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useStats } from '../api/hooks'
import type { BookFormat } from '../api/types'
import { FORMAT_LABEL } from '../api/types'
import { BarList, ColumnChart } from '../components/Charts'
import { Spinner, Stars, formatRating } from '../components/ui'

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1))
const fmt = (n: number) => n.toLocaleString()

export function StatsPage() {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const { data: s, isLoading } = useStats(year)

  if (isLoading || !s) return <Spinner />

  const years = Array.from(new Set([thisYear, ...s.history.map((h) => h.year)])).sort((a, b) => b - a)
  const goalPct = s.goal ? Math.min(100, Math.round((s.booksFinished / s.goal) * 100)) : null
  const rated = s.ratingDistribution.reduce((n, b) => n + b.count, 0)

  // Expected books by now if reading evenly through the year — only meaningful for the current year.
  const dayOfYear = Math.floor((Date.now() - new Date(thisYear, 0, 0).getTime()) / 86_400_000)
  const expected = s.goal && year === thisYear ? Math.round((s.goal * dayOfYear) / 365) : null
  const pace = expected !== null ? s.booksFinished - expected : null

  return (
    <>
      <section className="band band--hero">
        <div className="container split" style={{ alignItems: 'end' }}>
          <div className="stack stack--lg">
            <div className="chips" role="group" aria-label="Year">
              {years.map((y) => (
                <button
                  key={y}
                  className="chip chip--hero"
                  aria-pressed={y === year}
                  onClick={() => setYear(y)}
                >
                  {y}
                </button>
              ))}
            </div>
            <h1 className="display">Your {year} in reading.</h1>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <p className="eyebrow">Books finished</p>
            <p className="hero-figure">{fmt(s.booksFinished)}</p>
            {s.goal ? (
              <div className="stack" style={{ gap: 6, maxWidth: 420 }}>
                <div className="progress">
                  <span style={{ width: `${goalPct}%` }} />
                </div>
                <span className="small" style={{ color: 'var(--hero-soft)' }}>
                  {goalPct}% of your {s.goal}-book goal
                  {pace !== null && (pace >= 0 ? ` · ${pace === 0 ? 'right on' : `${pace} ahead of`} pace` : ` · ${-pace} behind pace`)}
                </span>
              </div>
            ) : year === thisYear ? (
              <Link to="/settings" className="link small">
                Set a yearly goal
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="band band--cream">
        <div className="container stack stack--lg">
          <div className="stat-grid">
            <Stat label="Pages read" value={fmt(s.pagesRead)} hint={s.pagesPerDay ? `${s.pagesPerDay} a day` : undefined} />
            <Stat
              label="Average rating"
              value={s.averageRating != null ? formatRating(Math.round(s.averageRating * 10) / 10) : '—'}
              hint={rated ? `from ${rated} rated ${rated === 1 ? 'book' : 'books'}` : 'No ratings yet'}
            >
              {s.averageRating != null && <Stars value={Math.round(s.averageRating * 2) / 2} size={14} />}
            </Stat>
            <Stat label="Days per book" value={s.averageDaysToFinish != null ? `${s.averageDaysToFinish}` : '—'} hint="from start to finish" />
            <Stat label="On the go" value={fmt(s.currentlyReading)} hint={`${fmt(s.wantToRead)} waiting · ${s.didNotFinish} DNF`} />
          </div>

          <div className="chart-grid">
            <div className="chart-card">
              <ColumnChart
                title="Books finished per month"
                data={s.monthly.map((m, i) => ({
                  label: MONTHS[i].toLocaleDateString(undefined, { month: 'narrow' }),
                  fullLabel: MONTHS[i].toLocaleDateString(undefined, { month: 'long' }),
                  value: m.books,
                  detail: `${m.books} ${m.books === 1 ? 'book' : 'books'} · ${fmt(m.pages)} pages`,
                }))}
              />
            </div>
            <div className="chart-card">
              <ColumnChart
                title="How you rate"
                data={s.ratingDistribution.map((b) => ({
                  label: Number.isInteger(b.rating) ? `${b.rating}` : `${Math.floor(b.rating) || ''}½`,
                  fullLabel: `${formatRating(b.rating)} stars`,
                  value: b.count,
                  detail: `${b.count} ${b.count === 1 ? 'book' : 'books'}`,
                }))}
              />
            </div>
          </div>

          <div className="chart-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <div className="chart-card">
              <BarList title="Most-read authors" items={s.topAuthors} unit="book" />
            </div>
            <div className="chart-card">
              <BarList title="Subjects" items={s.topSubjects} unit="book" />
            </div>
            <div className="chart-card stack" style={{ gap: 16 }}>
              <h3>Highlights</h3>
              {s.longest ? (
                <>
                  <Highlight label="Longest book" title={s.longest.title} id={s.longest.userBookId} meta={`${fmt(s.longest.pages)} pages`} />
                  {s.shortest && s.shortest.userBookId !== s.longest.userBookId && (
                    <Highlight label="Shortest book" title={s.shortest.title} id={s.shortest.userBookId} meta={`${fmt(s.shortest.pages)} pages`} />
                  )}
                </>
              ) : (
                <p className="small muted" style={{ margin: 0 }}>
                  Finish a book to see highlights.
                </p>
              )}
            </div>
            <div className="chart-card stack" style={{ gap: 14 }}>
              <BarList
                title="How you read"
                unit="book"
                items={s.formats.map((f) => ({ name: FORMAT_LABEL[f.name as BookFormat] ?? f.name, count: f.count }))}
              />
              {s.readAndListened > 0 && (
                <p className="small muted" style={{ margin: 0 }}>
                  {s.readAndListened} {s.readAndListened === 1 ? 'book' : 'books'} both read and listened to.
                </p>
              )}
              {s.formats.length === 0 && s.booksFinished > 0 && (
                <p className="caption muted" style={{ margin: 0 }}>
                  Mark books as Book, E-book or Audiobook on their page to see this.
                </p>
              )}
            </div>
          </div>

          {s.history.length > 1 && (
            <div className="chart-card">
              <ColumnChart
                title="Books finished per year"
                height={200}
                data={s.history.map((h) => ({
                  label: `${h.year}`,
                  value: h.books,
                  detail: `${h.books} ${h.books === 1 ? 'book' : 'books'} · ${fmt(h.pages)} pages`,
                }))}
              />
            </div>
          )}
        </div>
      </section>
    </>
  )
}

function Stat({ label, value, hint, children }: { label: string; value: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="stat">
      <p className="stat__label">{label}</p>
      <p className="stat__value">{value}</p>
      {children}
      {hint && <p className="stat__hint">{hint}</p>}
    </div>
  )
}

function Highlight({ label, title, id, meta }: { label: string; title: string; id: string; meta: string }) {
  return (
    <div className="stack" style={{ gap: 2 }}>
      <span className="caption muted">{label}</span>
      <Link to={`/library/${id}`} className="link" style={{ textDecoration: 'none', fontWeight: 600 }}>
        {title}
      </Link>
      <span className="small muted">{meta}</span>
    </div>
  )
}
