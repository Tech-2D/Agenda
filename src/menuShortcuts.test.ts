import { afterEach, expect, it, vi } from 'vitest'
import { agendaMenuUrl, MENU_SHORTCUTS_KEY, readAgendaMenuDialog, readMenuShortcuts, storeMenuShortcuts } from './menuShortcuts'

afterEach(() => vi.unstubAllGlobals())

it('reuses the existing saved shortcut order across sites', () => {
  const storage = new Map([[MENU_SHORTCUTS_KEY, '["updates","kanban","updates","invalid","settings"]']])
  vi.stubGlobal('window', { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } })
  expect(readMenuShortcuts()).toEqual(['updates', 'kanban', 'settings'])
  storeMenuShortcuts(['settings', 'updates'])
  expect(storage.get('agenda:menu-shortcuts:v1')).toBe('["settings","updates"]')
})

it('opens known features directly without accepting arbitrary routes', () => {
  for (const id of ['notifications', 'polls', 'updates', 'notices', 'mySuggestions', 'settings'] as const) {
    const url = new URL(agendaMenuUrl(id), 'https://tech-2d.github.io')
    expect(url.pathname).toBe('/')
    expect(readAgendaMenuDialog(url.hash)).toBe(id)
  }
  expect(new URL(agendaMenuUrl('kanban'), 'https://tech-2d.github.io').hash).toBe('#kanban')
  expect(new URL(agendaMenuUrl('admin'), 'https://tech-2d.github.io').hash).toBe('#admin')
  expect(new URL(agendaMenuUrl('options'), 'https://tech-2d.github.io').hash).toBe('#opcoes')
  for (const hash of ['#menu=unknown', '#menu=admin', '#menu=https://example.com', '#atividade=1']) expect(readAgendaMenuDialog(hash)).toBeNull()
})
