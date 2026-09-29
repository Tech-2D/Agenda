import { describe, expect, it } from 'vitest'
import { teacherFinderTodayUrl } from './teacherFinder'

describe('teacherFinderTodayUrl', () => {
  it('linka para a grade de hoje já na turma equivalente', () => {
    expect(teacherFinderTodayUrl('2° TECH D')).toBe(
      'https://tech-2d.github.io/professores/?view=hoje&turma=2%C2%BA+Tec+D',
    )
  })

  it('abre em hoje sem filtro de turma quando não há turma conhecida', () => {
    expect(teacherFinderTodayUrl(null)).toBe('https://tech-2d.github.io/professores/?view=hoje')
    expect(teacherFinderTodayUrl('Turma sem par no Cadê o professor?')).toBe(
      'https://tech-2d.github.io/professores/?view=hoje',
    )
  })
})
