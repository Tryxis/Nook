import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { GuestButton } from '../components/GuestButton'
import { Footer } from '../components/Layout'
import { Confetti, Cover, LogoMark, Stars } from '../components/ui'
import { ensureFonts, renderShareCard } from '../lib/shareImage'

// Public showcase covers (Open Library, by ISBN). Purely decorative.
const SHOWCASE = [
  { isbn: '9781635575637', title: 'Piranesi', author: 'Susanna Clarke' },
  { isbn: '9780593135204', title: 'Project Hail Mary', author: 'Andy Weir' },
  { isbn: '9780316556347', title: 'Circe', author: 'Madeline Miller' },
  { isbn: '9780593318171', title: 'Klara and the Sun', author: 'Kazuo Ishiguro' },
  { isbn: '9780307744432', title: 'The Night Circus', author: 'Erin Morgenstern' },
  { isbn: '9781984822178', title: 'Normal People', author: 'Sally Rooney' },
  { isbn: '9780141439518', title: 'Pride and Prejudice', author: 'Jane Austen' },
  { isbn: '9780547928227', title: 'The Hobbit', author: 'J.R.R. Tolkien' },
  { isbn: '9780735219090', title: 'Where the Crawdads Sing', author: 'Delia Owens' },
  { isbn: '9780062315007', title: 'The Alchemist', author: 'Paulo Coelho' },
]
const cover = (isbn: string, size = 'L') => `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg?default=false`

export function WelcomePage() {
  return (
    <>
      <header className="nav">
        <div className="container nav__inner">
          <Link to="/welcome" className="brand">
            <LogoMark /> Nook
          </Link>
          <div className="row" style={{ marginLeft: 'auto', gap: 8 }}>
            <GuestButton className="nav__link link-button" label="Try as guest" />
            <Link to="/login" className="nav__link">
              Sign in
            </Link>
            <Link to="/register" className="btn btn--white btn--sm hide-on-phone">
              Start your diary
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="band band--hero" style={{ position: 'relative', overflow: 'hidden' }}>
          <div className="container split">
            <div className="stack stack--lg">
              <h1 className="display">Every book, beautifully remembered.</h1>
              <p className="lede muted" style={{ color: 'var(--hero-soft)' }}>
                Nook is a reading diary for the books you love: track when you started and finished, bookmark the
                passages that stopped you, rate in half stars and share a review that looks as good as the book.
              </p>
              <div className="row">
                <Link to="/register" className="btn btn--white">
                  Start your diary — it's free
                </Link>
                <GuestButton className="btn btn--ghost" label="Look around as a guest" />
              </div>
              <Link to="/login" className="link small" style={{ alignSelf: 'start' }}>
                I already have an account
              </Link>
            </div>
            <div className="hero-stack" aria-hidden="true">
              <Confetti style={{ top: -10, right: 10 }} />
              <Cover src={cover(SHOWCASE[0].isbn)} title={SHOWCASE[0].title} eager className="hero-a" />
              <Cover src={cover(SHOWCASE[2].isbn)} title={SHOWCASE[2].title} eager className="hero-b" />
              <Cover src={cover(SHOWCASE[1].isbn)} title={SHOWCASE[1].title} eager className="hero-c" />
            </div>
          </div>
          <div className="container" style={{ marginTop: 64 }}>
            <div className="cover-row" aria-hidden="true">
              {SHOWCASE.map((b) => (
                <Cover key={b.isbn} src={cover(b.isbn, 'M')} title={b.title} author={b.author} />
              ))}
            </div>
          </div>
        </section>

        <section className="band band--cream">
          <div className="container">
            <div className="section-head">
              <h2 className="h1" style={{ maxWidth: 560 }}>
                A diary that keeps your place.
              </h2>
            </div>
            <div className="stat-grid">
              {[
                ['Search any book', 'Millions of titles from Open Library and Google Books, covers included.'],
                ['Dates & rereads', 'Start and finish dates are logged for you, and every reread is kept.'],
                ['Bookmarks', 'Save a page or percentage with a note, so you never lose the line you loved.'],
                ['Shelves', 'Organise your library into shelves: comfort reads, book club, the 2026 pile.'],
              ].map(([title, body]) => (
                <div key={title} className="stat stack" style={{ gap: 8 }}>
                  <h3 className="h3">{title}</h3>
                  <p className="small" style={{ margin: 0 }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="band band--alt">
          <div className="container split">
            <div className="stack stack--lg">
              <h2 className="h1">Share the books that stayed with you.</h2>
              <p className="lede">
                Turn any review into an Instagram story or post in one tap: the cover, your stars and your words, set on
                a background that looks like it belongs.
              </p>
              <div>
                <Link to="/register" className="btn btn--dark">
                  Make your first card
                </Link>
              </div>
            </div>
            <div className="feature-card" style={{ justifySelf: 'center', padding: 28 }}>
              <SampleCard />
            </div>
          </div>
        </section>

        <section className="band band--cream">
          <div className="container split">
            <div className="stack stack--lg">
              <h2 className="h1">Your year in reading, at a glance.</h2>
              <p className="lede">
                Books and pages per month, your rating habits, favourite authors and how you're tracking against your
                yearly goal.
              </p>
            </div>
            <div className="card card--white stack" style={{ maxWidth: 440 }}>
              <p className="eyebrow">This year</p>
              <p className="hero-figure" style={{ color: 'var(--ink)' }}>
                27
              </p>
              <p className="small" style={{ margin: 0 }}>
                books finished · 8,412 pages · average <Stars value={4} size={14} />
              </p>
              <div className="progress" style={{ marginTop: 8 }}>
                <span style={{ width: '68%' }} />
              </div>
              <p className="caption muted" style={{ margin: 0 }}>
                68% of a 40-book goal
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

/** A live render of the real share card, scaled down inside a phone frame. */
function SampleCard() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    ;(async () => {
      await ensureFonts()
      if (!ref.current) return
      await renderShareCard(
        ref.current,
        {
          coverUrl: cover(SHOWCASE[0].isbn),
          title: 'Piranesi',
          authors: ['Susanna Clarke'],
          rating: 4.5,
          review: 'Strange, luminous and kind — a house of endless halls that I did not want to leave.',
          status: 'Finished',
          finishedOn: null,
          progress: null,
          formats: ['Print'],
        },
        { format: 'story', theme: 'forest', includeReview: true },
      )
    })()
  }, [])
  return (
    <div style={{ borderRadius: 36, padding: 10, background: '#161015', boxShadow: 'var(--shadow-card)' }}>
      <canvas ref={ref} style={{ width: 240, height: 'auto', borderRadius: 28, display: 'block' }} aria-label="Example share card" />
    </div>
  )
}
