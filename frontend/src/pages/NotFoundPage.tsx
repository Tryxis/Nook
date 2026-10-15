import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="band band--cream" style={{ minHeight: '60vh' }}>
      <div className="container empty">
        <h1 className="display">Lost the page.</h1>
        <p className="muted">That page doesn't exist — maybe it was never written.</p>
        <Link to="/" className="btn btn--dark">
          Back home
        </Link>
      </div>
    </section>
  )
}
