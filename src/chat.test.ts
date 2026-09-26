import { describe, expect, it } from 'vitest'
import { prepareChatMessage } from './chat'

describe('mensagens do chat', () => {
  it('remove espaços das bordas sem perder quebras de linha', () => {
    expect(prepareChatMessage('  Olá!\nTenho uma dúvida.  ')).toBe('Olá!\nTenho uma dúvida.')
  })
  it('rejeita mensagens vazias ou grandes demais', () => {
    expect(() => prepareChatMessage('  \n ')).toThrow()
    expect(() => prepareChatMessage('a'.repeat(2001))).toThrow()
    expect(prepareChatMessage('a'.repeat(2000))).toHaveLength(2000)
  })
})
