import { describe, expect, it } from 'vitest'
import { countExpiredActivities, retentionCutoff } from './retention'

describe('prazo de expurgo', () => {
  it('considera apenas datas estritamente anteriores ao limite', () => {
    expect(retentionCutoff('2026-09-24', 30)).toBe('2026-08-25')
    expect(countExpiredActivities(['2026-08-24', '2026-08-25', '2026-08-26'], '2026-09-24', 30)).toBe(1)
  })

  it('rejeita prazos agressivos e valores inválidos', () => {
    expect(() => retentionCutoff('2026-09-24', 7)).toThrow()
    expect(() => retentionCutoff('2026-09-24', 30.5)).toThrow()
  })
})
