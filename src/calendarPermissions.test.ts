import { describe, expect, it } from 'vitest'
import { canEditCalendarActivity } from './calendarPermissions'

describe('edição pelo calendário', () => {
  it('permite ao representante editar somente sua turma', () => {
    const profile = { role: 'representante' as const, turmaId: '2° TECH D' }
    expect(canEditCalendarActivity(profile, { turmaId: '2° TECH D' })).toBe(true)
    expect(canEditCalendarActivity(profile, { turmaId: '2° TECH E' })).toBe(false)
    expect(canEditCalendarActivity(profile, { turmaId: null })).toBe(false)
  })
  it('permite ao super-admin editar qualquer turma e eventos gerais', () => {
    expect(canEditCalendarActivity({ role: 'superadmin' }, { turmaId: '2° TECH E' })).toBe(true)
    expect(canEditCalendarActivity({ role: 'superadmin' }, { turmaId: null })).toBe(true)
  })
  it('não permite editar sem perfil aprovado ou sem turma válida', () => {
    expect(canEditCalendarActivity(null, { turmaId: '2° TECH D' })).toBe(false)
    expect(canEditCalendarActivity({ role: 'representante' }, { turmaId: null })).toBe(false)
  })
})
