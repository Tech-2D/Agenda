import { afterEach, describe, expect, it, vi } from 'vitest'
import { readPreferredTurma, savePreferredTurma } from './classPreference'

afterEach(() => vi.unstubAllGlobals())

function mockStorage(values = new Map<string, string>()) {
  vi.stubGlobal('window', { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } })
  return values
}

describe('preferência de turma da Agenda', () => {
  it('aproveita a escolha antiga e salva o nome compartilhado com Professores', () => {
    const values = mockStorage(new Map([['agenda:turma', '2° TECH H']]))
    expect(readPreferredTurma()).toBe('2° TECH H')
    savePreferredTurma('2° TECH H')
    expect(values.get('tech-2d:preferredClass')).toBe('2º Tec H')
  })

  it('lê uma escolha feita em Professores e não inventa turma incompatível', () => {
    const values = mockStorage(new Map([['tech-2d:preferredClass', '2º Tec D']]))
    expect(readPreferredTurma()).toBe('2° TECH D')
    values.set('tech-2d:preferredClass', '8º A')
    expect(readPreferredTurma()).toBeNull()
  })
})
