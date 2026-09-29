import { describe, expect, it } from 'vitest'
import { isValidClassName, normalizeClassName } from './classRequests'

describe('pedido de nova turma', () => {
  it('normaliza grafia antes do envio', () => {
    expect(normalizeClassName('  3º  Tec   DS E  ')).toBe('3º TEC DS E')
  })
  it('impede caminhos, quebras de linha e nomes excessivos', () => {
    expect(isValidClassName('3º TEC DS E')).toBe(true)
    for (const name of ['a', 'Sala/privada', 'Sala\nOutro', 'x'.repeat(61)]) expect(isValidClassName(name)).toBe(false)
  })
})
