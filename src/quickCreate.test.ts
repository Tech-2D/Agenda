import { describe, expect, it } from 'vitest'
import { canCreateForSelectedClass } from './quickCreate'

describe('cadastro pelo dia do calendário', () => {
  it('permite ao representante cadastrar na própria turma', () => {
    expect(canCreateForSelectedClass({ role: 'representante', turmaId: '2º Tec D' }, '2º Tec D')).toBe(true)
  })

  it('não abre cadastro rápido em outra turma ou sem login', () => {
    expect(canCreateForSelectedClass({ role: 'representante', turmaId: '2º Tec D' }, '2º Tec E')).toBe(false)
    expect(canCreateForSelectedClass(null, '2º Tec D')).toBe(false)
  })

  it('permite ao superadministrador usar a turma exibida', () => {
    expect(canCreateForSelectedClass({ role: 'superadmin' }, '2º Tec E')).toBe(true)
  })
})
