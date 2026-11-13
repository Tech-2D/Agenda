import { describe, expect, it } from 'vitest'
import { CLASS_NAMES } from './classNames'
import { parseSchedulesJson } from './importSchedules'

const valid = {
  professor: 'Ana Silva', subject: 'Matemática', className: '6º A', floor: '',
  startTime: '07:00', endTime: '07:50', roomDescription: '', dayOfWeek: 1, active: false,
}

describe('importação de horários', () => {
  it('aceita aulas sem localização ativas ou inativas', () => {
    expect(parseSchedulesJson(JSON.stringify([valid]))).toHaveLength(1)
    expect(parseSchedulesJson(JSON.stringify([{ ...valid, active: true }]))[0].active).toBe(true)
  })

  it('rejeita turma desconhecida e horários duplicados', () => {
    expect(() => parseSchedulesJson(JSON.stringify([{ ...valid, className: '6º Z' }]))).toThrow('não reconhecida')
    expect(() => parseSchedulesJson(JSON.stringify([valid, valid]))).toThrow('duplicado')
  })

  it('aceita importações para todas as turmas dos professores, incluindo as que não têm agenda', () => {
    const text = JSON.stringify(CLASS_NAMES.map(className => ({ ...valid, className, active: true })))
    const rows = parseSchedulesJson(text)
    expect(rows).toHaveLength(CLASS_NAMES.length)
    expect(rows.some((row) => row.className === '2º Neg B')).toBe(true)
    expect(rows.some((row) => row.className === '6º A')).toBe(true)
    expect(rows.every((row) => row.active && !row.floor && !row.roomDescription)).toBe(true)
  })
})
