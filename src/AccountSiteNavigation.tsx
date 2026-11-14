import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import { subscribeAdminProfile } from './adminAccess'
import { observeCalendarSession } from './calendarSession'
import { SiteNavigation } from './SiteNavigation'
import type { AdminProfile } from './types'

export function AccountSiteNavigation({ active, menu }: Pick<React.ComponentProps<typeof SiteNavigation>, 'menu'> & { active: 'professores' | 'pegaki' }) {
  const [profile, setProfile] = useState<AdminProfile | null>(null)

  useEffect(() => observeCalendarSession({
    subscribeAccount: change => onAuthStateChanged(auth, user => change(user?.uid ?? null)),
    subscribeProfile: subscribeAdminProfile,
    publish: setProfile,
    reset: () => {},
  }), [])

  return <SiteNavigation active={active} role={profile?.role} menu={menu} />
}
