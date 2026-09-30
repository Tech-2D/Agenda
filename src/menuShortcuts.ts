export const MENU_SHORTCUT_IDS = [
  'notifications', 'updates', 'polls', 'notices', 'suggestActivity', 'todayClasses',
  'requestClass', 'feedback', 'mySuggestions', 'admin', 'settings', 'profiles',
  'help', 'teachers', 'pong',
] as const

export type MenuShortcutId = (typeof MENU_SHORTCUT_IDS)[number]
export const DEFAULT_MENU_SHORTCUTS: readonly MenuShortcutId[] = ['notifications', 'updates', 'polls']
const KEY = 'agenda:menu-shortcuts:v1'

export function readMenuShortcuts(): MenuShortcutId[] {
  try {
    const saved = window.localStorage.getItem(KEY)
    if (saved === null) return [...DEFAULT_MENU_SHORTCUTS]
    const value: unknown = JSON.parse(saved)
    if (Array.isArray(value)) {
      return [...new Set(value.filter((id): id is MenuShortcutId =>
        typeof id === 'string' && (MENU_SHORTCUT_IDS as readonly string[]).includes(id),
      ))]
    }
  } catch {
    // Se o navegador bloquear o armazenamento, usamos os atalhos padrão.
  }
  return [...DEFAULT_MENU_SHORTCUTS]
}

export function storeMenuShortcuts(ids: readonly MenuShortcutId[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // A seleção continua funcionando durante esta sessão.
  }
}
