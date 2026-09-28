import type { RecurringActivity } from './types'

export const REPEAT_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function validateCustomRepeat(start: string, end: string, days: number[], interval: number): string | null {
  if (!days.length) return 'Escolha pelo menos um dia da semana.'
  if (!end || end < start) return 'Escolha uma data final igual ou posterior à data inicial.'
  if (!Number.isInteger(interval) || interval < 1 || interval > 12) return 'O intervalo precisa ser de 1 a 12 semanas.'
  const first = new Date(`${start}T12:00:00Z`)
  const anchor = new Date(first)
  anchor.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7)
  for (let offset = 0; offset <= interval * 7; offset++) {
    const candidate = new Date(first)
    candidate.setUTCDate(first.getUTCDate() + offset)
    const date = candidate.toISOString().slice(0, 10)
    if (date > end) break
    const week = Math.floor((candidate.getTime() - anchor.getTime()) / (7 * 86400000))
    if (week % interval === 0 && days.includes(candidate.getUTCDay())) return null
  }
  return 'O prazo escolhido não inclui nenhum dos dias selecionados.'
}

export function recurrenceLabel(item: RecurringActivity): string {
  if (!item.weekdays) return 'Toda semana, no mesmo dia'
  return `A cada ${item.intervalWeeks ?? 1} semana(s) · ${item.weekdays.map(day => REPEAT_DAYS[day]).join(', ')}`
}
