export type SystemUpdate = {
  id: string
  title: string
  body: string
  createdBy: string
  publishedAt?: { toDate: () => Date } | null
}

const SEEN_KEY = 'agenda:latestSystemUpdateSeen'

export function readSeenSystemUpdateId(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

export function markSystemUpdateSeen(id: string): void {
  try {
    window.localStorage.setItem(SEEN_KEY, id)
  } catch {
    // Se o armazenamento estiver bloqueado, a novidade poderá reaparecer.
  }
}

export function latestUnseenUpdate(updates: SystemUpdate[], seenId: string | null): SystemUpdate | null {
  const latest = updates[0]
  return latest && latest.id !== seenId ? latest : null
}
