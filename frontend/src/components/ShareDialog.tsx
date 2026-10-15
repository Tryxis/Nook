import { useEffect, useRef, useState } from 'react'
import type { UserBookDetail } from '../api/types'
import {
  SHARE_SIZES,
  SHARE_THEMES,
  canvasToBlob,
  ensureFonts,
  renderShareCard,
  swatchBackground,
  type ShareFormat,
  type ShareTheme,
} from '../lib/shareImage'
import { themeInfo } from '../lib/theme'
import { Modal, toast } from './ui'

export function ShareDialog({ entry, open, onClose }: { entry: UserBookDetail; open: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [format, setFormat] = useState<ShareFormat>('story')
  // Default the card to match the site theme the reader is using.
  const [theme, setTheme] = useState<ShareTheme>(() => themeInfo().share)
  const [includeReview, setIncludeReview] = useState(true)
  const [busy, setBusy] = useState(false)

  const hasReview = !!entry.review?.trim()
  const latestFinish = entry.readThroughs.find((r) => r.finishedOn && !r.abandoned)?.finishedOn ?? null
  const pages = entry.book.pageCount

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      await ensureFonts()
      if (cancelled || !canvasRef.current) return
      await renderShareCard(
        canvasRef.current,
        {
          coverUrl: entry.book.coverUrl,
          title: entry.book.title,
          authors: entry.book.authors,
          rating: entry.rating,
          review: entry.review,
          status: entry.status,
          finishedOn: latestFinish,
          progress: pages && entry.currentPage ? Math.min(1, entry.currentPage / pages) : null,
          formats: entry.formats,
        },
        { format, theme, includeReview },
      )
    })()
    return () => {
      cancelled = true
    }
  }, [open, entry, format, theme, includeReview, latestFinish, pages])

  const fileName = `${entry.book.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'book'}-${format}.png`

  async function download() {
    if (!canvasRef.current) return
    setBusy(true)
    try {
      const blob = await canvasToBlob(canvasRef.current)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toast('Image saved')
    } catch {
      toast('Could not create the image')
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    if (!canvasRef.current) return
    setBusy(true)
    try {
      const blob = await canvasToBlob(canvasRef.current)
      const file = new File([blob], fileName, { type: 'image/png' })
      await navigator.share({ files: [file], title: entry.book.title })
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') toast('Sharing failed — try saving the image instead')
    } finally {
      setBusy(false)
    }
  }

  const canShareFiles =
    typeof navigator !== 'undefined' &&
    'canShare' in navigator &&
    navigator.canShare?.({ files: [new File([new Blob()], 'x.png', { type: 'image/png' })] })

  return (
    <Modal open={open} onClose={onClose} title="Share to Instagram" wide>
      <div className="share-layout">
        <div className="share-preview">
          <canvas ref={canvasRef} aria-label="Preview of the share image" />
        </div>

        <div className="stack stack--lg">
          <div className="stack" style={{ gap: 10 }}>
            <span className="field__label">Size</span>
            <div className="chips">
              {(Object.keys(SHARE_SIZES) as ShareFormat[]).map((f) => (
                <button key={f} className="chip" aria-pressed={format === f} onClick={() => setFormat(f)}>
                  {SHARE_SIZES[f].label}
                </button>
              ))}
            </div>
          </div>

          <div className="stack" style={{ gap: 10 }}>
            <span className="field__label">Background</span>
            <div className="row" style={{ gap: 10 }}>
              {(Object.keys(SHARE_THEMES) as ShareTheme[]).map((t) => (
                <button
                  key={t}
                  className="swatch"
                  style={{ background: swatchBackground(SHARE_THEMES[t]) }}
                  aria-pressed={theme === t}
                  aria-label={SHARE_THEMES[t].label}
                  title={SHARE_THEMES[t].label}
                  onClick={() => setTheme(t)}
                />
              ))}
            </div>
          </div>

          {hasReview && (
            <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={includeReview} onChange={(e) => setIncludeReview(e.target.checked)} />
              <span className="small">Include my review</span>
            </label>
          )}
          {!entry.rating && !hasReview && (
            <p className="small muted" style={{ margin: 0 }}>
              Tip: add a rating or review and it'll appear on the card.
            </p>
          )}

          <div className="stack" style={{ gap: 10 }}>
            {canShareFiles && (
              <button className="btn btn--dark" onClick={share} disabled={busy}>
                Share…
              </button>
            )}
            <button className={`btn ${canShareFiles ? 'btn--ghost' : 'btn--dark'}`} onClick={download} disabled={busy}>
              Save image
            </button>
            <p className="caption muted" style={{ margin: 0 }}>
              {SHARE_SIZES[format].w}×{SHARE_SIZES[format].h}px PNG. On a phone, “Share…” opens Instagram directly.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  )
}
