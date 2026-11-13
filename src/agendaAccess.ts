import type { User } from 'firebase/auth'
import { auth } from './firebase'
import { SQL_BASE, SQL_ENABLED } from './dataBackend'

export async function recordAgendaAccess(account: User | null) {
  const response = await recordSiteAccess('agenda', account)
  if (response?.status !== 403) return false
  return (await response.json().catch(() => null))?.code === 'agenda-access-blocked'
}

export async function recordSiteAccess(site: 'agenda' | 'professor' | 'pegaki', account: User | null) {
  if (!SQL_ENABLED) return
  try {
    const token = await account?.getIdToken()
    if (auth.currentUser?.uid !== account?.uid) return
    return await fetch(SQL_BASE + '/api/' + site + '-access', {
      method: 'POST',
      ...(token ? { headers: { Authorization: 'Bearer ' + token } } : {}),
      credentials: 'omit',
      redirect: 'error',
      keepalive: true,
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    // Reporting is best effort and does not block navigation.
  }
}
