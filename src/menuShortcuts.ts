export const MENU_SHORTCUT_IDS = [
  'notifications', 'updates', 'polls', 'notices', 'suggestActivity', 'todayClasses',
  'requestClass', 'feedback', 'mySuggestions', 'admin', 'settings', 'profiles',
  'help', 'teachers', 'pong', 'kanban', 'pegaki',
] as const

export type MenuShortcutId = (typeof MENU_SHORTCUT_IDS)[number]
export const DEFAULT_MENU_SHORTCUTS: readonly MenuShortcutId[] = ['notifications', 'updates', 'polls']
export const MENU_SHORTCUTS_KEY = 'agenda:menu-shortcuts:v1'

export function readMenuShortcuts(): MenuShortcutId[] {
  try {
    const saved = window.localStorage.getItem(MENU_SHORTCUTS_KEY)
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
    window.localStorage.setItem(MENU_SHORTCUTS_KEY, JSON.stringify(ids))
  } catch {
    // A seleção continua funcionando durante esta sessão.
  }
}

const AGENDA_URL = sitePaths.agenda
const AGENDA_DIALOGS = ['notifications', 'updates', 'polls', 'notices', 'suggestActivity', 'requestClass', 'feedback', 'mySuggestions', 'settings', 'profiles', 'help'] as const

export function readAgendaMenuDialog(hash: string) {
  if (!hash.startsWith('#menu=')) return null
  const id = hash.slice('#menu='.length)
  return AGENDA_DIALOGS.find(dialog => dialog === id) ?? null
}

export function agendaMenuUrl(id?: MenuShortcutId | 'options') {
  if (!id) return AGENDA_URL
  if (id === 'options') return AGENDA_URL + '#opcoes'
  if (id === 'admin') return sitePaths.admin
  if (id === 'kanban') return sitePaths.kanban
  return AGENDA_DIALOGS.some(dialog => dialog === id) ? AGENDA_URL + '#menu=' + id : AGENDA_URL
}
import { sitePaths } from './sitePaths'
