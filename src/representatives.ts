export type ApprovedRepresentative = {
  id: string
  email: string
  turmaId: string
  approvedAt: Date | null
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()

export function filterRepresentatives(items: ApprovedRepresentative[], search: string) {
  const term = normalize(search)
  return items.filter(item => normalize(`${item.email} ${item.turmaId}`).includes(term))
    .sort((a, b) => a.turmaId.localeCompare(b.turmaId, 'pt-BR', { numeric: true }) || a.email.localeCompare(b.email, 'pt-BR'))
}
