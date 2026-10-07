import { afterEach, describe, expect, it, vi } from 'vitest'
import { readStoredTheme, storeTheme, THEMES, THEME_LABELS, THEME_PREVIEW } from './theme'

afterEach(() => vi.unstubAllGlobals())

describe('temas claros', () => {
  it.each(['rosa', 'roxo'] as const)('salva e recupera o tema %s independentemente do neon', theme => {
    const values = new Map<string, string>([['agenda:neon', 'azul']])
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } })
    expect(THEMES).toContain(theme)
    expect(THEME_LABELS[theme]).toContain('claro')
    expect(THEME_PREVIEW[theme]).toMatch(/^#[0-9a-f]{6}$/)
    storeTheme(theme)
    expect(readStoredTheme()).toBe(theme)
    expect(values.get('agenda:neon')).toBe('azul')
  })

  it('mantém preferências antigas e ignora temas desconhecidos', () => {
    const getItem = vi.fn().mockReturnValue('cyberpunk')
    vi.stubGlobal('window', { localStorage: { getItem } })
    expect(readStoredTheme()).toBe('cyberpunk')
    getItem.mockReturnValue('inexistente')
    expect(readStoredTheme()).toBe('padrao')
  })

  it('funciona com armazenamento indisponível', () => {
    vi.stubGlobal('window', { localStorage: {
      getItem: () => { throw new Error('bloqueado') },
      setItem: () => { throw new Error('bloqueado') },
    } })
    expect(readStoredTheme()).toBe('padrao')
    expect(() => storeTheme('rosa')).not.toThrow()
  })
})
