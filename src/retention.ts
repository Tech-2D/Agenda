const DAY_MS = 24 * 60 * 60 * 1000

export const MIN_RETENTION_DAYS = 30
export const MAX_RETENTION_DAYS = 730

export function retentionCutoff(today: string, days: number): string {
  if (!Number.isInteger(days) || days < MIN_RETENTION_DAYS || days > MAX_RETENTION_DAYS) {
    throw new Error(`Escolha um prazo entre ${MIN_RETENTION_DAYS} e ${MAX_RETENTION_DAYS} dias.`)
  }
  const date = new Date(`${today}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) throw new Error('Data atual inválida.')
  return new Date(date.getTime() - days * DAY_MS).toISOString().slice(0, 10)
}

export function countExpiredActivities(dates: string[], today: string, days: number): number {
  const cutoff = retentionCutoff(today, days)
  return dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date < cutoff).length
}
