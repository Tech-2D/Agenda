import { auth } from './firebase'
import { SQL_ENABLED } from './dataBackend'
import { catalogWriteEndpoint, fetchCatalog } from './catalogTransport'
import { mergeQueuedActivities, pendingActivityStates, QUEUED_CHANGED } from './optimisticActivities'
import type { Activity } from './types'

export type CatalogMeta = { generatedAt: string; stale: boolean }
const CHANGED = 'tech2d-public-catalog-changed'

function hydrate(value: unknown, key = ''): unknown {
  if (typeof value === 'string' && ['createdAt', 'updatedAt', 'publishedAt'].includes(key) && Number.isFinite(Date.parse(value))) {
    return { toDate: () => new Date(value) }
  }
  if (Array.isArray(value)) return value.map(item => hydrate(item))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([field, item]) => [field, hydrate(item, field)]))
  return value
}

export function observeCatalog<T>(resource: 'schedules' | 'agenda' | 'updates', change: (data: T & { meta: CatalogMeta }) => void, error: () => void, className?: string) {
  let stopped = false
  let running = false
  let timer: ReturnType<typeof setTimeout>
  let lastAttempt = 0
  let nextAllowed = 0
  let lastContent = ''
  let recovering = false
  let lastPayload:Record<string,unknown> | null=null
  const abort = new AbortController()
  function deliver(payload:Record<string,unknown>,optimistic=true) {
    const data=hydrate(payload) as T & {meta:CatalogMeta;activities?:Activity[]}
    if(resource==='agenda' && Array.isArray(data.activities) && optimistic)data.activities=mergeQueuedActivities(data.activities,className,true)
    change(data)
  }
  async function poll() {
    if (stopped || running || document.hidden) return
    clearTimeout(timer)
    if (Date.now() < nextAllowed) {
      clearTimeout(timer)
      timer = setTimeout(() => void poll(), nextAllowed - Date.now())
      return
    }
    running = true
    lastAttempt = Date.now()
    let delay = 60000
    try {
      const response = await fetchCatalog(resource, className, abort.signal, await auth.currentUser?.getIdToken())
      if (!response.ok) {
        const retry = Number(response.headers.get('Retry-After'))
        delay = Math.max(60000, Math.min((retry || 120) * 1000, 300000))
        throw new Error('PUBLIC_QUERY_FAILED')
      }
      const payload = await response.json()
      lastPayload=payload
      const content = JSON.stringify({ ...payload, meta: { stale: payload.meta?.stale } })
      if (!stopped && (content !== lastContent || recovering)) {
        deliver(payload)
        lastContent = content
      }
      recovering = false
      nextAllowed = 0
    } catch {
      recovering = true
      if (!stopped) error()
      nextAllowed = Date.now() + delay
    } finally {
      running = false
      if (!stopped) timer = setTimeout(() => void poll(), delay)
    }
  }
  const wake = () => { if (Date.now() - lastAttempt > 10000) void poll() }
  const changed = () => { nextAllowed = 0; void poll() }
  const queued=(event:Event)=>{
    const detail=(event as CustomEvent<{path?:string;reset?:boolean}>).detail
    if(resource!=='agenda' || !detail?.reset && !detail?.path?.startsWith('activities/'))return
    if(detail?.reset){if(lastPayload)deliver(lastPayload,false);changed();return}
    if(pendingActivityStates().length){if(lastPayload)deliver(lastPayload)}else changed()
  }
  document.addEventListener('visibilitychange', wake)
  window.addEventListener('focus', wake)
  window.addEventListener(CHANGED, changed)
  window.addEventListener(QUEUED_CHANGED,queued)
  void poll()
  return () => {
    stopped = true
    abort.abort()
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', wake)
    window.removeEventListener('focus', wake)
    window.removeEventListener(CHANGED, changed)
    window.removeEventListener(QUEUED_CHANGED,queued)
  }
}

export async function invalidateCatalog(target: 'schedules' | 'agenda'): Promise<boolean> {
  if (SQL_ENABLED) { window.dispatchEvent(new Event(CHANGED)); return true }
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return false
    const result = await fetch(`${catalogWriteEndpoint()}/invalidate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
      signal: AbortSignal.timeout(15000),
    })
    if (!result.ok) return false
    window.dispatchEvent(new Event(CHANGED))
    return true
  } catch { return false }
}
