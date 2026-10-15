import { useLayoutEffect, useRef, useState } from 'react'

export interface Datum {
  label: string
  value: number
  /** Tooltip body, e.g. "3 books · 912 pages". */
  detail: string
  /** Full label for tooltip/table when the axis label is abbreviated. */
  fullLabel?: string
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1]
  const rough = max / 4
  const pow = 10 ** Math.floor(Math.log10(rough))
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? pow * 10)
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

/** Column path with a 4px rounded data-end and a square baseline. */
function columnPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

/**
 * Single-series column chart. No legend (the card title names the series), value label on the
 * peak only, per-column hover tooltip, and an optional table view for screen readers / exact values.
 */
export function ColumnChart({
  data,
  height = 220,
  title,
}: {
  data: Datum[]
  height?: number
  title: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)

  const max = Math.max(0, ...data.map((d) => d.value))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const padL = 32
  const padB = 28
  const padT = 20
  const plotW = Math.max(0, width - padL)
  const plotH = height - padB - padT
  const band = data.length ? plotW / data.length : 0
  const barW = Math.min(24, band * 0.62)
  const y = (v: number) => padT + plotH - (v / top) * plotH
  const peak = data.findIndex((d) => d.value === max && max > 0)

  return (
    <div className="chart stack" style={{ gap: 12 }}>
      <div className="row row--between">
        <h3>{title}</h3>
        <button className="link caption" onClick={() => setTable((t) => !t)} aria-pressed={table}>
          {table ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {table ? (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i}>
                <td>{d.fullLabel ?? d.label}</td>
                <td>{d.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={ref} style={{ position: 'relative' }}>
          {width > 0 && (
            <svg height={height} role="img" aria-label={`${title}. ${data.map((d) => `${d.fullLabel ?? d.label}: ${d.detail}`).join('; ')}`}>
              <g className="chart__grid">
                {ticks.map((t) => (
                  <line key={t} x1={padL} x2={width} y1={y(t)} y2={y(t)} />
                ))}
              </g>
              <g className="chart__axis">
                {ticks.map((t) => (
                  <text key={t} x={padL - 8} y={y(t) + 4} textAnchor="end">
                    {t}
                  </text>
                ))}
                {data.map((d, i) => (
                  <text key={i} x={padL + band * i + band / 2} y={height - 8} textAnchor="middle">
                    {d.label}
                  </text>
                ))}
              </g>
              {data.map((d, i) => {
                const h = (d.value / top) * plotH
                const x = padL + band * i + (band - barW) / 2
                const dim = hover !== null && hover !== i
                return (
                  <g key={i}>
                    {d.value > 0 && <path d={columnPath(x, y(d.value), barW, h)} className={dim ? 'chart__bar chart__bar--dim' : 'chart__bar'} />}
                    {i === peak && hover === null && (
                      <text className="chart__value" x={x + barW / 2} y={y(d.value) - 6} textAnchor="middle">
                        {d.value}
                      </text>
                    )}
                    {/* Hit target spans the whole band, larger than the mark. */}
                    <rect
                      className="chart__hit"
                      x={padL + band * i}
                      y={padT}
                      width={band}
                      height={plotH + padB}
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      onTouchStart={() => setHover(i)}
                    />
                  </g>
                )
              })}
            </svg>
          )}
          {hover !== null && width > 0 && (
            <div className="tooltip" style={{ left: padL + band * hover + band / 2, top: y(data[hover].value) }}>
              <strong>{data[hover].fullLabel ?? data[hover].label}</strong>
              {data[hover].detail}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Ranked horizontal bars with the label above and the value at the tip. */
export function BarList({ items, title, unit }: { items: { name: string; count: number }[]; title: string; unit: string }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <div className="stack" style={{ gap: 14 }}>
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>
          Nothing yet this year.
        </p>
      ) : (
        <ol className="stack" style={{ gap: 12, listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((i) => (
            <li key={i.name} className="hbar">
              <span style={{ color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</span>
              <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {i.count} {i.count === 1 ? unit : `${unit}s`}
              </span>
              <div className="hbar__track">
                <div className="hbar__fill" style={{ width: `${(i.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
