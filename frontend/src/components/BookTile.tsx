import { Link } from 'react-router-dom'
import type { UserBookSummary } from '../api/types'
import { Cover, FormatIcons, Stars, StatusTag } from './ui'

export function BookTile({ entry, showStatus = false }: { entry: UserBookSummary; showStatus?: boolean }) {
  const author = entry.book.authors[0] ?? ''
  return (
    <Link to={`/library/${entry.id}`} className="tile">
      <Cover src={entry.book.coverUrl} title={entry.book.title} author={author} />
      <div className="stack" style={{ gap: 4 }}>
        <span className="tile__title">{entry.book.title}</span>
        {author && <span className="tile__author">{author}</span>}
        {(entry.rating != null || entry.formats.length > 0) && (
          <span className="row" style={{ gap: 8 }}>
            {entry.rating != null && <Stars value={entry.rating} size={14} />}
            <FormatIcons formats={entry.formats} />
          </span>
        )}
        {showStatus && (
          <span>
            <StatusTag status={entry.status} />
          </span>
        )}
      </div>
    </Link>
  )
}

export function TileSkeletons({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="tile" aria-hidden="true">
          <div className="cover skeleton" />
          <div className="skeleton" style={{ height: 14, width: '80%' }} />
          <div className="skeleton" style={{ height: 12, width: '50%' }} />
        </div>
      ))}
    </>
  )
}
