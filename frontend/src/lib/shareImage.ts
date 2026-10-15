// Renders a book status/review card to a <canvas> sized for Instagram, entirely client-side.
// Covers come from our same-origin /api/books/{id}/cover proxy, so the canvas stays exportable.

import type { BookFormat, ReadingStatus } from '../api/types'
import { isListenOnly, isReadAndListened } from '../api/types'

export type ShareFormat = 'story' | 'post'
export type ShareTheme = 'forest' | 'sky' | 'cream' | 'vaporwave' | 'mono' | 'blush'

export const SHARE_SIZES: Record<ShareFormat, { w: number; h: number; label: string }> = {
  story: { w: 1080, h: 1920, label: 'Story · 9:16' },
  post: { w: 1080, h: 1350, label: 'Post · 4:5' },
}

export interface ShareThemeDef {
  label: string
  /** Solid fill, also used for the swatch when there's no gradient. */
  bg: string
  /** Optional vertical gradient stops drawn over the fill. */
  gradient?: [number, string][]
  /** Optional synthwave horizon grid colour. */
  grid?: string
  ink: string
  soft: string
  star: string
  empty: string
  /** Decorative accents: star, circle, small circle / plus. */
  accents: [string, string, string]
  mark: { bg: string; page: string; accent: string }
}

export const SHARE_THEMES: Record<ShareTheme, ShareThemeDef> = {
  forest: {
    label: 'Forest', bg: '#064c37', ink: '#ffffff', soft: 'rgba(255,255,255,0.72)', star: '#e8a33d', empty: 'rgba(255,255,255,0.22)',
    accents: ['#e8a33d', '#43a1d7', '#f7f4ee'], mark: { bg: 'rgba(255,255,255,0.14)', page: '#ffffff', accent: '#43a1d7' },
  },
  sky: {
    label: 'Sky', bg: '#43a1d7', ink: '#161015', soft: 'rgba(22,16,21,0.72)', star: '#e8a33d', empty: 'rgba(22,16,21,0.18)',
    accents: ['#e8a33d', '#ffffff', '#064c37'], mark: { bg: '#161015', page: '#ffffff', accent: '#43a1d7' },
  },
  cream: {
    label: 'Cream', bg: '#f7f4ee', ink: '#161015', soft: '#3f383d', star: '#e8a33d', empty: 'rgba(22,16,21,0.14)',
    accents: ['#e8a33d', '#43a1d7', '#064c37'], mark: { bg: '#064c37', page: '#ffffff', accent: '#43a1d7' },
  },
  vaporwave: {
    label: 'Vaporwave', bg: '#170a3a',
    gradient: [[0, '#170a3a'], [0.55, '#3c1371'], [1, '#c2287e']],
    grid: 'rgba(255,113,206,0.42)',
    ink: '#ffffff', soft: 'rgba(255,220,245,0.85)', star: '#fffb96', empty: 'rgba(255,255,255,0.2)',
    accents: ['#fffb96', '#01cdfe', '#05ffa1'], mark: { bg: '#ff71ce', page: '#170a3a', accent: '#01cdfe' },
  },
  mono: {
    label: 'Monochrome', bg: '#0d0d0d', ink: '#ffffff', soft: 'rgba(255,255,255,0.68)', star: '#ffffff', empty: 'rgba(255,255,255,0.2)',
    accents: ['#ffffff', '#8c8c8c', '#d4d4d4'], mark: { bg: '#ffffff', page: '#0d0d0d', accent: '#8c8c8c' },
  },
  blush: {
    label: 'Cosy pastel', bg: '#f6c9d4',
    gradient: [[0, '#f9d9e0'], [1, '#e9c6e4']],
    ink: '#3d2430', soft: 'rgba(61,36,48,0.74)', star: '#8e3a5a', empty: 'rgba(61,36,48,0.16)',
    accents: ['#e8964a', '#a99ae0', '#fffdfc'], mark: { bg: '#a34868', page: '#fffaf7', accent: '#f0b27a' },
  },
}

/** CSS background for a theme's swatch button. */
export function swatchBackground(t: ShareThemeDef) {
  return t.gradient ? `linear-gradient(180deg, ${t.gradient.map(([o, c]) => `${c} ${o * 100}%`).join(', ')})` : t.bg
}

export interface ShareCardData {
  coverUrl: string | null
  title: string
  authors: string[]
  rating: number | null
  review: string | null
  status: ReadingStatus
  finishedOn: string | null
  progress: number | null // 0–1, for books in progress
  formats: BookFormat[]
}

const DISPLAY = 'Fraunces, Lora, Georgia, serif'
const UI = 'Inter, system-ui, sans-serif'

export async function ensureFonts() {
  if (!('fonts' in document)) return
  await Promise.all([
    document.fonts.load(`400 64px Fraunces`),
    document.fonts.load(`italic 400 40px Fraunces`),
    document.fonts.load(`500 32px Inter`),
    document.fonts.load(`600 24px Inter`),
  ]).catch(() => undefined)
}

const imageCache = new Map<string, Promise<HTMLImageElement | null>>()

export function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  let p = imageCache.get(url)
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
    imageCache.set(url, p)
  }
  return p
}

export async function renderShareCard(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
  opts: { format: ShareFormat; theme: ShareTheme; includeReview: boolean },
) {
  const { w: W, h: H } = SHARE_SIZES[opts.format]
  const t = SHARE_THEMES[opts.theme]
  const story = opts.format === 'story'
  const cover = await loadImage(data.coverUrl)

  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'

  // Background + a few geometric accents in the corners.
  ctx.fillStyle = t.bg
  ctx.fillRect(0, 0, W, H)
  if (t.gradient) {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    t.gradient.forEach(([o, c]) => g.addColorStop(o, c))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
  if (t.grid) drawHorizonGrid(ctx, W, H, t.grid)
  drawAccents(ctx, W, H, t)

  const review = opts.includeReview && data.review?.trim() ? data.review.trim() : null
  const padX = 96

  // ---- Measure each block so the whole composition can be vertically centred. ----
  const headerY = story ? 150 : 104
  const footerH = story ? 150 : 110
  const coverW = story ? (review ? 470 : 580) : review ? 330 : 430
  const coverH = Math.round(coverW * 1.5)

  const titleSize = story ? 68 : 56
  ctx.font = `400 ${titleSize}px ${DISPLAY}`
  const titleLines = wrap(ctx, data.title, W - padX * 2, 2)
  const titleLH = titleSize * 1.02

  const authorSize = story ? 34 : 30
  const author = data.authors.slice(0, 2).join(' & ')

  const starSize = story ? 72 : 60
  const hasStars = data.rating != null

  let reviewSize = story ? 42 : 34
  let reviewLines: string[] = []
  if (review) {
    const maxLines = story ? 7 : 4
    ctx.font = `italic 400 ${reviewSize}px ${DISPLAY}`
    reviewLines = wrap(ctx, `“${review}”`, W - padX * 2 - 40, maxLines)
    // Long reviews step down a size before being truncated.
    if (reviewLines.length === maxLines && reviewLines[maxLines - 1].endsWith('…')) {
      reviewSize = story ? 36 : 30
      ctx.font = `italic 400 ${reviewSize}px ${DISPLAY}`
      reviewLines = wrap(ctx, `“${review}”`, W - padX * 2 - 40, maxLines + 1)
    }
  }
  const reviewLH = reviewSize * 1.32

  const gap = story ? 56 : 40
  const blocks =
    coverH +
    gap +
    titleLines.length * titleLH +
    (author ? 16 + authorSize * 1.3 : 0) +
    (hasStars ? gap * 0.8 + starSize : 0) +
    (reviewLines.length ? gap * 0.9 + reviewLines.length * reviewLH : 0)

  const top = headerY + 40
  const bottom = H - footerH
  let y = top + Math.max(0, (bottom - top - blocks) / 2)

  // ---- Header: status line ----
  ctx.fillStyle = t.soft
  ctx.font = `600 ${story ? 26 : 22}px ${UI}`
  ctx.textAlign = 'center'
  drawTracked(ctx, statusLine(data).toUpperCase(), W / 2, headerY, 3)

  // ---- Cover ----
  const cx = (W - coverW) / 2
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 48
  ctx.shadowOffsetY = 18
  roundRect(ctx, cx, y, coverW, coverH, 10)
  ctx.fillStyle = '#292229'
  ctx.fill()
  ctx.restore()
  ctx.save()
  roundRect(ctx, cx, y, coverW, coverH, 10)
  ctx.clip()
  if (cover) {
    drawCoverFit(ctx, cover, cx, y, coverW, coverH)
  } else {
    drawBlankCover(ctx, cx, y, coverW, coverH, data.title, author)
  }
  ctx.restore()
  y += coverH + gap

  // ---- Title + author ----
  ctx.fillStyle = t.ink
  ctx.textAlign = 'center'
  ctx.font = `400 ${titleSize}px ${DISPLAY}`
  for (const line of titleLines) {
    y += titleSize * 0.82
    ctx.fillText(line, W / 2, y)
    y += titleLH - titleSize * 0.82
  }
  if (author) {
    y += 16
    ctx.fillStyle = t.soft
    ctx.font = `500 ${authorSize}px ${UI}`
    y += authorSize
    ctx.fillText(ellipsize(ctx, author, W - padX * 2), W / 2, y)
    y += authorSize * 0.3
  }

  // ---- Stars ----
  if (hasStars) {
    y += gap * 0.8
    const starGap = starSize * 0.22
    const total = starSize * 5 + starGap * 4
    let sx = (W - total) / 2
    for (let i = 1; i <= 5; i++) {
      const fill = data.rating! >= i ? 1 : data.rating! >= i - 0.5 ? 0.5 : 0
      drawStar(ctx, sx, y, starSize, fill, t.empty, t.star)
      sx += starSize + starGap
    }
    y += starSize
  }

  // ---- Review ----
  if (reviewLines.length) {
    y += gap * 0.9
    ctx.fillStyle = t.ink
    ctx.font = `italic 400 ${reviewSize}px ${DISPLAY}`
    for (const line of reviewLines) {
      y += reviewSize
      ctx.fillText(line, W / 2, y)
      y += reviewLH - reviewSize
    }
  }

  // ---- Footer: wordmark ----
  const fy = H - footerH / 2 - (story ? 10 : 0)
  ctx.font = `400 ${story ? 40 : 34}px ${DISPLAY}`
  const word = 'Nook'
  const ww = ctx.measureText(word).width
  const markS = story ? 46 : 40
  const fx = (W - (ww + markS + 16)) / 2
  drawMark(ctx, fx, fy - markS * 0.78, markS, t)
  ctx.fillStyle = t.ink
  ctx.textAlign = 'left'
  ctx.fillText(word, fx + markS + 16, fy)
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png'),
  )
}

// ---- Drawing helpers ----

function statusLine(d: ShareCardData) {
  const listening = isListenOnly(d.formats)
  switch (d.status) {
    case 'Finished': {
      const verb = listening ? 'Finished listening' : isReadAndListened(d.formats) ? 'Read & listened' : 'Finished'
      if (!d.finishedOn) return verb === 'Finished' ? 'Finished reading' : verb
      const date = new Date(`${d.finishedOn}T12:00:00`)
      return `${verb} · ${date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
    }
    case 'Reading': {
      const verb = listening ? 'Currently listening' : 'Currently reading'
      return d.progress ? `${verb} · ${Math.round(d.progress * 100)}%` : verb
    }
    case 'DidNotFinish':
      return 'Did not finish'
    default:
      return 'Up next on my shelf'
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, ' ').split(' ')
  const lines: string[] = []
  let line = ''
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i]
    if (ctx.measureText(test).width <= maxWidth) {
      line = test
      continue
    }
    if (line) lines.push(line)
    line = words[i]
    if (lines.length === maxLines) {
      lines[maxLines - 1] = ellipsize(ctx, `${lines[maxLines - 1]} ${words.slice(i).join(' ')}`, maxWidth, true)
      return lines
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const rest = lines.splice(maxLines - 1).join(' ')
    lines.push(ellipsize(ctx, rest, maxWidth, true))
  }
  return lines.map((l) => ellipsize(ctx, l, maxWidth))
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, force = false) {
  if (!force && ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t.trimEnd().replace(/[,.;:“"]$/, '')}…`
}

function drawTracked(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, tracking: number) {
  // Canvas letterSpacing is not universal yet; fall back to manual spacing.
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in c) {
    c.letterSpacing = `${tracking}px`
    ctx.fillText(text, cx, y)
    c.letterSpacing = '0px'
  } else {
    ctx.fillText(text, cx, y)
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** object-fit: cover */
function drawCoverFit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h)
}

function drawBlankCover(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, title: string, author: string) {
  ctx.fillStyle = '#292229'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#f7f4ee'
  ctx.textAlign = 'left'
  const size = Math.round(w / 8)
  ctx.font = `400 ${size}px ${DISPLAY}`
  const lines = wrap(ctx, title, w - w * 0.2, 5)
  let ly = y + h * 0.14
  for (const l of lines) {
    ly += size
    ctx.fillText(l, x + w * 0.1, ly)
    ly += size * 0.1
  }
  ctx.font = `500 ${Math.round(w / 18)}px ${UI}`
  ctx.globalAlpha = 0.75
  ctx.fillText(ellipsize(ctx, author, w * 0.8), x + w * 0.1, y + h - h * 0.08)
  ctx.globalAlpha = 1
}

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const cx = x + s / 2
  const cy = y + s / 2 + s * 0.03
  const outer = s / 2
  const inner = outer * 0.45
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const px = cx + r * Math.cos(a)
    const py = cy + r * Math.sin(a)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, fill: number, empty: string, color: string) {
  ctx.save()
  ctx.lineJoin = 'round'
  starPath(ctx, x, y, s)
  ctx.fillStyle = empty
  ctx.fill()
  if (fill > 0) {
    ctx.beginPath()
    ctx.rect(x, y - 2, s * fill, s + 4)
    ctx.clip()
    starPath(ctx, x, y, s)
    ctx.fillStyle = color
    ctx.fill()
  }
  ctx.restore()
}

function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: ShareThemeDef) {
  const k = s / 32
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(k, k)
  ctx.fillStyle = t.mark.bg
  roundRect(ctx, 0, 0, 32, 32, 8)
  ctx.fill()
  ctx.fillStyle = t.mark.page
  ctx.globalAlpha = 0.85
  ctx.fill(new Path2D('M8 9.5c3-1 5.5-.7 8 1v13c-2.5-1.7-5-2-8-1z'))
  ctx.globalAlpha = 1
  ctx.fill(new Path2D('M24 9.5c-3-1-5.5-.7-8 1v13c2.5-1.7 5-2 8-1z'))
  ctx.fillStyle = t.mark.accent
  ctx.fill(new Path2D('M19.5 9.6v6l1.5-1.2 1.5 1.2V9.4'))
  ctx.restore()
}

/** Receding neon grid across the bottom third, faded towards the horizon. */
function drawHorizonGrid(ctx: CanvasRenderingContext2D, W: number, H: number, color: string) {
  const horizon = Math.round(H * 0.68)
  const gh = H - horizon
  // Drawn on its own layer so the fade only removes grid lines, not the background beneath.
  const layer = document.createElement('canvas')
  layer.width = W
  layer.height = gh
  const g = layer.getContext('2d')!
  g.strokeStyle = color
  g.lineWidth = 2
  const vp = W / 2
  for (let i = -12; i <= 12; i++) {
    g.beginPath()
    g.moveTo(vp + i * 14, 0)
    g.lineTo(vp + i * 150, gh)
    g.stroke()
  }
  for (let i = 1; i < 14; i++) {
    const y = gh * (i / 13) ** 2
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(W, y)
    g.stroke()
  }
  const fade = g.createLinearGradient(0, 0, 0, gh * 0.6)
  fade.addColorStop(0, 'rgba(0,0,0,1)')
  fade.addColorStop(1, 'rgba(0,0,0,0)')
  g.globalCompositeOperation = 'destination-out'
  g.fillStyle = fade
  g.fillRect(0, 0, W, gh)
  ctx.drawImage(layer, 0, horizon)
}

function drawAccents(ctx: CanvasRenderingContext2D, W: number, H: number, t: ShareThemeDef) {
  const [a, b, c] = t.accents
  ctx.save()
  drawStar(ctx, W - 190, 70, 64, 1, 'transparent', a)
  ctx.fillStyle = b
  ctx.beginPath()
  ctx.arc(70, H * 0.3, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = c
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.arc(W - 62, H * 0.62, 11, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.strokeStyle = a
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  // Kept within the left margin (text never starts before x = 96).
  const px = 58
  const py = H * 0.74
  ctx.beginPath()
  ctx.moveTo(px - 20, py)
  ctx.lineTo(px + 20, py)
  ctx.moveTo(px, py - 20)
  ctx.lineTo(px, py + 20)
  ctx.stroke()
  ctx.restore()
}
