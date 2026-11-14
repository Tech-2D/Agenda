import { auth } from './firebase'
import { fetchCatalog } from './catalogTransport'
import type { Activity } from './types'

const validId = (id: string) => /^[A-Za-z0-9_-]{1,128}$/.test(id)
export function readActivityLink(hash: string): string | null {
  if (!hash.startsWith('#atividade=')) return null
  const params = new URLSearchParams(hash.slice(1))
  const id = params.get('atividade')
  return params.size === 1 && id && validId(id) ? id : null
}
export function activityLink(id: string, base: string): string {
  if (!validId(id)) throw Error('Atividade inválida.')
  const url = new URL(base)
  url.search = ''
  url.hash = 'atividade=' + encodeURIComponent(id)
  return url.href
}
export async function loadLinkedActivity(id: string, signal: AbortSignal): Promise<Activity | null> {
  if (!validId(id)) throw Error('Link de atividade inválido.')
  const response = await fetchCatalog('activities/' + encodeURIComponent(id), undefined, signal, await auth.currentUser?.getIdToken())
  if (response.status === 404) return null
  if (!response.ok) throw Error('Não foi possível carregar a atividade. Tente novamente.')
  const result = await response.json()
  if (result.activity?.id !== id || typeof result.activity.title !== 'string') throw Error('Resposta de atividade inválida.')
  return result.activity as Activity
}
