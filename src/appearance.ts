import { readStoredNeon, readStoredTheme } from './theme'
import { readStoredFontScale, readStoredHighContrast, readStoredReduceMotion } from './accessibility'

export function applyStoredAppearance() {
  const root = document.documentElement
  root.dataset.theme = readStoredTheme()
  root.dataset.neon = readStoredNeon()
  root.dataset.fontScale = readStoredFontScale()
  root.dataset.contrast = readStoredHighContrast() ? 'alto' : 'normal'
  root.dataset.motion = readStoredReduceMotion() ? 'reduzido' : 'normal'
}

export function observeStoredAppearance() {
  applyStoredAppearance()
  const sync = (event: StorageEvent) => {
    if (event.key === null || /^(agenda|professores):/.test(event.key)) applyStoredAppearance()
  }
  window.addEventListener('storage', sync)
  return () => window.removeEventListener('storage', sync)
}
