import type { User } from 'firebase/auth'
import { auth } from './firebase'
import { SQL_BASE, SQL_ENABLED } from './dataBackend'

export async function recordAgendaAccess(account: User | null) {
  if (!SQL_ENABLED) return false
  try {
    const token = await account?.getIdToken()
    if (auth.currentUser?.uid !== account?.uid) return false
    const response = await fetch(SQL_BASE + '/api/agenda-access', {
      method: 'POST',
      ...(token ? { headers: { Authorization: 'Bearer ' + token } } : {}),
      credentials: 'omit',
      redirect: 'error',
      keepalive: true,
      signal: AbortSignal.timeout(15000),
    })
    if (response.status !== 403) return false
    return (await response.json().catch(() => null))?.code === 'agenda-access-blocked'
  } catch {
    return false
  }
}
