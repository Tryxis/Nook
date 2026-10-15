import { THEMES, setTheme, useTheme } from '../lib/theme'

/** Full picker with previews, for the Settings page. */
export function ThemePicker() {
  const current = useTheme()
  return (
    <div className="theme-grid" role="radiogroup" aria-label="Site theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={current === t.id}
          className="theme-option"
          onClick={() => setTheme(t.id)}
        >
          <span className="theme-option__preview" aria-hidden="true">
            <span style={{ background: t.swatches[0] }} />
            <span style={{ background: t.swatches[1] }} />
            <span style={{ background: t.swatches[2] }} />
            <span style={{ background: t.swatches[3] }} />
          </span>
          <span className="theme-option__label">{t.label}</span>
          <span className="caption muted">{t.description}</span>
        </button>
      ))}
    </div>
  )
}

/** Compact select for the footer, so the theme can be changed signed out too. */
export function ThemeSelect() {
  const current = useTheme()
  return (
    <label className="row" style={{ gap: 8 }}>
      <span>Theme</span>
      <select className="theme-select" value={current} onChange={(e) => setTheme(e.target.value as typeof current)}>
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  )
}
