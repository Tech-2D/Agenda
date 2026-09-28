import type { AdminProfile } from './types'

type Stop = () => void
type SessionSource = {
  subscribeAccount: (change: (uid: string | null) => void) => Stop
  subscribeProfile: (uid: string, change: (profile: AdminProfile | null) => void, error: () => void) => Stop
  publish: (profile: AdminProfile | null) => void
  reset: () => void
}

// Invalida respostas de listeners antigos antes de conferir a nova conta.
export function observeCalendarSession(source: SessionSource): Stop {
  let revision = 0
  let active = true
  let stopProfile: Stop = () => {}
  const stopAccount = source.subscribeAccount(uid => {
    if (!active) return
    const currentRevision = ++revision
    stopProfile()
    stopProfile = () => {}
    source.publish(null)
    source.reset()
    if (!uid) return
    const publish = (profile: AdminProfile | null) => {
      if (currentRevision !== revision) return
      source.publish(profile && ['representante', 'superadmin'].includes(profile.role) ? profile : null)
    }
    stopProfile = source.subscribeProfile(uid, publish, () => publish(null))
  })
  return () => { active = false; revision += 1; stopAccount(); stopProfile() }
}
