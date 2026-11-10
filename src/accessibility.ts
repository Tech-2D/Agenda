export const FONT_SCALES = ['normal', 'grande', 'maior'] as const
export type FontScale = (typeof FONT_SCALES)[number]

export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  normal: 'Normal',
  grande: 'Grande',
  maior: 'Muito grande',
}

const FONT_KEY = 'agenda:fontScale'
const CONTRAST_KEY = 'agenda:highContrast'
const MOTION_KEY = 'agenda:reduceMotion'

function readBoolean(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function storeBoolean(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // localStorage indisponível — a escolha só vale para esta sessão.
  }
}

export function readStoredFontScale(): FontScale {
  try {
    const value = window.localStorage.getItem(FONT_KEY)
    return (FONT_SCALES as readonly string[]).includes(value ?? '') ? (value as FontScale) : 'normal'
  } catch {
    return 'normal'
  }
}

export function storeFontScale(value: FontScale) {
  try {
    window.localStorage.setItem(FONT_KEY, value)
  } catch {
    // localStorage indisponível — a escolha só vale para esta sessão.
  }
}

export const readStoredHighContrast = () => readBoolean(CONTRAST_KEY)
export const storeHighContrast = (value: boolean) => storeBoolean(CONTRAST_KEY, value)

export const readStoredReduceMotion = () => readBoolean(MOTION_KEY)
export const storeReduceMotion = (value: boolean) => storeBoolean(MOTION_KEY, value)
