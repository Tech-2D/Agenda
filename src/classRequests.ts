export type ClassRequest = {
  id: string
  className: string
  email: string
  status: 'pendente' | 'aprovada' | 'rejeitada'
  createdAt?: { toDate: () => Date } | null
}

export function normalizeClassName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR')
}

export function isValidClassName(value: string): boolean {
  return value.length >= 3 && value.length <= 60 && /^[\p{L}\p{N}º°ª .-]+$/u.test(value)
}
