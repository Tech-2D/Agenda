import { describe, expect, it } from 'vitest'
import { creditForUpdate, isCreditEligible } from './publicCredit'
import type { Feedback } from './types'

const feedback = { id: 'f1', message: 'Mais espaço no calendário', turmaId: null, createdAt: null, publicCreditName: 'Ana', publicCreditAllowed: true } as Feedback

describe('public credit', () => {
  it('keeps the email out of public update data', () => {
    expect(creditForUpdate({ ...feedback, createdByEmail: 'ana@example.com' })).toEqual({
      sourceFeedbackId: 'f1', sourceName: 'Ana', sourceMessage: 'Mais espaço no calendário',
    })
  })
  it('does not expose suggestions without consent or a chosen name', () => {
    expect(isCreditEligible({ ...feedback, publicCreditAllowed: false })).toBe(false)
    expect(isCreditEligible({ ...feedback, publicCreditName: '' })).toBe(false)
    expect(isCreditEligible({ ...feedback, publicCreditName: 'ana@example.com' })).toBe(false)
    expect(() => creditForUpdate({ ...feedback, publicCreditAllowed: false })).toThrow()
  })
})
