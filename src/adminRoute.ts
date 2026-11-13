import { sitePaths } from './sitePaths'

export function legacyAdminUrl(location: Pick<Location, 'pathname' | 'search' | 'hash'>) {
  if (location.pathname.replace(/\/$/, '') !== sitePaths.agenda.replace(/\/$/, '')) return null
  if (location.hash === '#admin') return sitePaths.admin + location.search
  if (location.hash !== '#representante') return null
  const params = new URLSearchParams(location.search)
  params.set('acesso', 'solicitar')
  return `${sitePaths.admin}?${params}`
}

export function isAdminRoute(pathname: string) {
  return pathname.replace(/\/$/, '') === sitePaths.admin.slice(0, -1)
}
