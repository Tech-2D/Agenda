export type CalendarView = 'day' | 'week' | 'month'
export const CALENDAR_VIEWS: { id: CalendarView; label: string }[] = [
  { id: 'day', label: 'Dia' }, { id: 'week', label: 'Semana' }, { id: 'month', label: 'Mês' },
]

export function periodDays(cursor: Date, view: 'day' | 'week'): Date[] {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - (view === 'week' ? cursor.getDay() : 0))
  return Array.from({ length: view === 'week' ? 7 : 1 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index))
}

export function movePeriod(cursor: Date, view: CalendarView, direction: number): Date {
  if (view !== 'month') return new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + direction * (view === 'week' ? 7 : 1))
  const target = new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return new Date(target.getFullYear(), target.getMonth(), Math.min(cursor.getDate(), lastDay))
}

export function periodTitle(cursor: Date, view: CalendarView): string {
  if (view === 'month') return cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  if (view === 'day') return cursor.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
  const days = periodDays(cursor, 'week')
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  return `${days[0].toLocaleDateString('pt-BR', options)} – ${days[6].toLocaleDateString('pt-BR', options)}`
}
