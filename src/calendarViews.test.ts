import { describe, expect, it } from 'vitest'
import { dateKey } from './calendar'
import { movePeriod, periodDays, periodTitle } from './calendarViews'

describe('visões de dia, semana e mês', () => {
  it('mostra só o dia escolhido sem conversão de fuso', () => {
    expect(periodDays(new Date(2026, 8, 28, 23, 59), 'day').map(dateKey)).toEqual(['2026-09-28'])
  })
  it('cobre domingo a sábado mesmo atravessando o ano', () => {
    const days = periodDays(new Date(2026, 11, 31), 'week')
    expect(days).toHaveLength(7)
    expect(dateKey(days[0])).toBe('2026-12-27')
    expect(dateKey(days[6])).toBe('2027-01-02')
    expect(days[0].getDay()).toBe(0)
    expect(days[6].getDay()).toBe(6)
  })
  it('navega conforme a visão e preserva o dia ao mudar de mês quando possível', () => {
    const cursor = new Date(2026, 8, 28)
    expect(dateKey(movePeriod(cursor, 'day', 1))).toBe('2026-09-29')
    expect(dateKey(movePeriod(cursor, 'week', -1))).toBe('2026-09-21')
    expect(dateKey(movePeriod(cursor, 'month', 1))).toBe('2026-10-28')
    expect(dateKey(movePeriod(new Date(2026, 0, 31), 'month', 1))).toBe('2026-02-28')
    expect(dateKey(movePeriod(new Date(2028, 0, 31), 'month', 1))).toBe('2028-02-29')
  })
  it('identifica o período e não muda a data original', () => {
    const cursor = new Date(2026, 8, 28)
    expect(periodTitle(cursor, 'day')).toContain('28')
    expect(periodTitle(cursor, 'month')).toContain('setembro')
    expect(periodTitle(new Date(2026, 11, 31), 'week')).toContain('2027')
    movePeriod(cursor, 'week', 1)
    expect(dateKey(cursor)).toBe('2026-09-28')
  })
})
