import { describe, expect, it } from 'vitest'
import { activitySaveError } from './activityErrors'

describe('erros ao salvar atividades', () => {
  it('distingue permissão recusada de erro de preenchimento', () => {
    expect(activitySaveError({ code: 'permission-denied' })).toContain('Falta de permissão')
    expect(activitySaveError({ code: 'firestore/permission-denied' })).toContain('não significa que você preencheu algo errado')
    expect(activitySaveError({ status: 403 })).toContain('própria turma')
  })
  it('orienta a entrar novamente quando a sessão expira', () => {
    expect(activitySaveError({ code: 'unauthenticated' })).toContain('entre novamente')
    expect(activitySaveError({ status: 401 })).toContain('Sessão não autorizada')
  })
  it('separa dados inválidos e limite do serviço', () => {
    expect(activitySaveError({ code: 'invalid-argument' })).toContain('Dados inválidos')
    expect(activitySaveError({ status: 400 })).toContain('incompatibilidade')
    expect(activitySaveError({ code: 'resource-exhausted' })).toContain('sem cota')
    expect(activitySaveError({ status: 429 })).toContain('Não é um erro no preenchimento')
  })
  it('identifica falhas de conexão', () => {
    for (const error of [{ code: 'unavailable' }, { code: 'deadline-exceeded' }, new TypeError('Failed to fetch')]) {
      expect(activitySaveError(error)).toContain('Falha de conexão')
    }
  })
  it('não inventa a causa de erros desconhecidos', () => {
    expect(activitySaveError(new Error('Falha inesperada'))).toContain('não foi possível identificar')
    expect(activitySaveError(null)).not.toContain('atividade foi salva')
    expect(activitySaveError(new TypeError('Unexpected value'))).toContain('não foi possível identificar')
    expect(activitySaveError({ status: 503 })).toContain('Falha no serviço de anexos')
  })
  it('explica o salvamento parcial apenas quando a etapa dos anexos falhou', () => {
    expect(activitySaveError({ status: 403 }, true)).toContain('A atividade foi salva, mas os anexos')
    expect(activitySaveError({ code: 'permission-denied' })).not.toContain('A atividade foi salva')
  })
})
