export const THEMES = ['padrao', 'rosa', 'roxo', 'escuro', 'cyberpunk'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_LABELS: Record<Theme, string> = {
  padrao: 'Padrão',
  rosa: 'Rosa claro',
  roxo: 'Roxo claro',
  escuro: 'Escuro',
  cyberpunk: 'Cyberpunk',
}

// Cor de pré-visualização do tema no seletor (não é a paleta inteira, só um aceno visual).
export const THEME_PREVIEW: Record<Theme, string> = {
  padrao: '#0e35be',
  rosa: '#b51e70',
  roxo: '#7536b5',
  escuro: '#3b6dff',
  cyberpunk: 'linear-gradient(135deg, #ff2b54, #25e0ff)',
}

export const NEON_COLORS = ['vermelho', 'roxo', 'verde', 'azul', 'rosa'] as const
export type NeonColor = (typeof NEON_COLORS)[number]

export const NEON_COLOR_LABELS: Record<NeonColor, string> = {
  vermelho: 'Vermelho',
  roxo: 'Roxo',
  verde: 'Verde claro',
  azul: 'Azul',
  rosa: 'Rosa',
}

export const NEON_COLOR_SWATCHES: Record<NeonColor, string> = {
  vermelho: '#ff2b54',
  roxo: '#b430ff',
  verde: '#39ff8f',
  azul: '#25e0ff',
  rosa: '#ff2ec4',
}

const THEME_KEY = 'agenda:theme'
const NEON_KEY = 'agenda:neon'

export function readStoredTheme(): Theme {
  try {
    const value = window.localStorage.getItem(THEME_KEY)
    return (THEMES as readonly string[]).includes(value ?? '') ? (value as Theme) : 'padrao'
  } catch {
    return 'padrao'
  }
}

export function readStoredNeon(): NeonColor {
  try {
    const value = window.localStorage.getItem(NEON_KEY)
    return (NEON_COLORS as readonly string[]).includes(value ?? '') ? (value as NeonColor) : 'azul'
  } catch {
    return 'azul'
  }
}

export function storeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    // localStorage indisponível — a escolha só vale para esta sessão.
  }
}

export function storeNeon(neon: NeonColor) {
  try {
    window.localStorage.setItem(NEON_KEY, neon)
  } catch {
    // localStorage indisponível — a escolha só vale para esta sessão.
  }
}
