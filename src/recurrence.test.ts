import { describe, expect, it } from 'vitest'
import { validateCustomRepeat } from './recurrence'

describe('custom repeat', () => {
  it('allows Thursday and Friday within two weeks', () => {
    expect(validateCustomRepeat('2026-10-01', '2026-10-09', [4, 5], 1)).toBeNull()
  })
  it('requires selected days, a deadline and a valid interval', () => {
    expect(validateCustomRepeat('2026-10-01', '2026-10-09', [], 1)).not.toBeNull()
    expect(validateCustomRepeat('2026-10-01', '', [4], 1)).not.toBeNull()
    expect(validateCustomRepeat('2026-10-01', '2026-09-30', [4], 1)).not.toBeNull()
    expect(validateCustomRepeat('2026-10-01', '2026-10-09', [4], 0)).not.toBeNull()
  })
  it('rejects periods containing no selected day', () => {
    expect(validateCustomRepeat('2026-10-01', '2026-10-02', [1], 1)).not.toBeNull()
  })
  it('respects skipped weeks when validating the deadline', () => {
    expect(validateCustomRepeat('2026-09-27', '2026-09-28', [1], 2)).not.toBeNull()
    expect(validateCustomRepeat('2026-09-27', '2026-10-05', [1], 2)).toBeNull()
  })
})
