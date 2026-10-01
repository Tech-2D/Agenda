import { afterEach, describe, expect, it, vi } from 'vitest'
import { readCompareTurmas, saveCompareTurmas, shortTurmaLabel, toggleTurma } from './compareTurmas'

afterEach(() => vi.unstubAllGlobals())

function mockStorage(values = new Map<string, string>()) {
  vi.stubGlobal('window', { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } })
  return values
}

describe('seleção lembrada no modo comparar turmas', () => {
  it('lê só as turmas conhecidas, ignorando lixo salvo antes', () => {
    mockStorage(new Map([['tech-2d:compareTurmas', JSON.stringify(['2° TECH D', '2° TECH Removida', 42])]]))
    expect(readCompareTurmas(['2° TECH D', '2° TECH E'])).toEqual(['2° TECH D'])
  })

  it('não quebra com storage vazio ou corrompido', () => {
    mockStorage()
    expect(readCompareTurmas(['2° TECH D'])).toEqual([])
    mockStorage(new Map([['tech-2d:compareTurmas', 'não é json']]))
    expect(readCompareTurmas(['2° TECH D'])).toEqual([])
  })

  it('salva a combinação marcada', () => {
    const values = mockStorage()
    saveCompareTurmas(['2° TECH D', '2° TECH E'])
    expect(values.get('tech-2d:compareTurmas')).toBe(JSON.stringify(['2° TECH D', '2° TECH E']))
  })

  it('liga e desliga uma turma na lista', () => {
    expect(toggleTurma(['2° TECH D'], '2° TECH E')).toEqual(['2° TECH D', '2° TECH E'])
    expect(toggleTurma(['2° TECH D', '2° TECH E'], '2° TECH D')).toEqual(['2° TECH E'])
  })

  it('encurta o rótulo pro último pedaço do nome, sem adivinhar o resto', () => {
    expect(shortTurmaLabel('2° TECH D')).toBe('D')
    expect(shortTurmaLabel('3° TECH AD H')).toBe('H')
    expect(shortTurmaLabel('TurmaSemEspaco')).toBe('TurmaSemEspaco')
  })
})
