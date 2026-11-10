import { afterEach, describe, expect, it, vi } from 'vitest'
import { readStoredNeon, readStoredTheme, storeNeon, storeTheme } from './theme'

afterEach(() => vi.unstubAllGlobals())

describe('preferências de aparência', () => {
  it('usa o tema padrão e a cor azul quando não há preferência salva', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null } })
    expect(readStoredTheme()).toBe('padrao')
    expect(readStoredNeon()).toBe('azul')
  })

  it('recupera somente valores de tema e cor conhecidos', () => {
    const values = new Map([['professores:theme', 'neon'], ['professores:neon', 'rosa']])
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } })
    expect(readStoredTheme()).toBe('neon')
    expect(readStoredNeon()).toBe('rosa')
    storeTheme('padrao')
    storeNeon('verde')
    expect(values.get('agenda:theme')).toBe('padrao')
    expect(values.get('agenda:neon')).toBe('verde')
    values.set('agenda:theme', 'desconhecido')
    values.set('agenda:neon', 'desconhecido')
    expect(readStoredTheme()).toBe('padrao')
    expect(readStoredNeon()).toBe('azul')
  })

  it.each(['rosa', 'roxo', 'escuro', 'cyberpunk'])('aplica o tema %s da Agenda antes de preferências antigas', theme => {
    const values = new Map([['agenda:theme', theme], ['agenda:neon', 'roxo'], ['professores:theme', 'neon'], ['professores:neon', 'rosa']])
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => values.get(key) ?? null } })
    expect(readStoredTheme()).toBe(theme)
    expect(readStoredNeon()).toBe('roxo')
  })
})
