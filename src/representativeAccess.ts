export const REPRESENTATIVE_REQUEST_STORAGE_KEY = 'agenda:representative-request'

export type RepresentativeRequestStatus = 'pendente' | 'aprovada' | 'rejeitada'

export type RepresentativeRequest = {
  id: string
  email: string
  turmaId: string
  status: RepresentativeRequestStatus
  createdAt?: { toDate: () => Date } | null
  reviewedAt?: { toDate: () => Date } | null
}

export function normalizeRepresentativeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidRepresentativeEmail(value: string): boolean {
  return value.length <= 254 && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(value)
}

export function readRepresentativeRequestId(): string {
  try {
    return window.localStorage.getItem(REPRESENTATIVE_REQUEST_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function storeRepresentativeRequestId(id: string): void {
  try {
    if (id) window.localStorage.setItem(REPRESENTATIVE_REQUEST_STORAGE_KEY, id)
    else window.localStorage.removeItem(REPRESENTATIVE_REQUEST_STORAGE_KEY)
  } catch {
    // A solicitação ainda funciona quando o navegador bloqueia o armazenamento local.
  }
}
