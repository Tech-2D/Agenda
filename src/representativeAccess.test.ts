import { describe, expect, it } from 'vitest'
import { isValidRepresentativeEmail, normalizeRepresentativeEmail } from './representativeAccess'

describe('solicitação de representante', () => {
  it('normaliza o e-mail antes de solicitar ou cadastrar', () => {
    expect(normalizeRepresentativeEmail('  Aluno@Escola.COM  ')).toBe('aluno@escola.com')
  })

  it('rejeita e-mails inválidos', () => {
    expect(isValidRepresentativeEmail('aluno@escola.com')).toBe(true)
    expect(isValidRepresentativeEmail('sem-arroba')).toBe(false)
    expect(isValidRepresentativeEmail('ALUNO@escola.com')).toBe(false)
  })
})
