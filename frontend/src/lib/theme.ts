import { useSyncExternalStore } from 'react'
import type { ShareTheme } from './shareImage'

export type SiteTheme = 'classic' | 'vaporwave' | 'mono' | 'blush'

export interface ThemeInfo {
  id: SiteTheme
  label: string
  description: string
  /** Preview swatches: hero, alt band, surface, accent. */
  swatches: [string, string, string, string]
  /** Browser UI colour (mobile address bar). Matches the nav. */
  chrome: string
  /** Share-card background picked by default under this theme. */
  share: ShareTheme
}

export const THEMES: ThemeInfo[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Forest green, sky blue and cream paper.',
    swatches: ['#064c37', '#43a1d7', '#f7f4ee', '#e8a33d'],
    chrome: '#064c37',
    share: 'forest',
  },
  {
    id: 'vaporwave',
    label: 'Vaporwave',
    description: 'Midnight purple, neon pink and a synthwave sunset.',
    swatches: ['#3c1371', '#ff71ce', '#1b0c36', '#01cdfe'],
    chrome: '#170a3a',
    share: 'vaporwave',
  },
  {
    id: 'mono',
    label: 'Monochrome',
    description: 'Ink on paper. No colour, just contrast.',
    swatches: ['#0d0d0d', '#d4d4d4', '#f2f2f2', '#707070'],
    chrome: '#0d0d0d',
    share: 'mono',
  },
  {
    id: 'blush',
    label: 'Cosy pastel',
    description: 'Blush pink, lavender and honey, like a reading nook at dusk.',
    swatches: ['#f6c9d4', '#dcd0f2', '#fbeef0', '#a34868'],
    chrome: '#f6c9d4',
    share: 'blush',
  },
]

const KEY = 'nook.theme'
const listeners = new Set<() => void>()

function isTheme(v: unknown): v is SiteTheme {
  return THEMES.some((t) => t.id === v)
}

export function getTheme(): SiteTheme {
  const attr = document.documentElement.dataset.theme
  return isTheme(attr) ? attr : 'classic'
}

export function themeInfo(id: SiteTheme = getTheme()): ThemeInfo {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export function setTheme(id: SiteTheme) {
  document.documentElement.dataset.theme = id
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeInfo(id).chrome)
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // Private mode / storage disabled: the theme still applies for this visit.
  }
  listeners.forEach((l) => l())
}

export function useTheme(): SiteTheme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getTheme,
    () => 'classic',
  )
}
