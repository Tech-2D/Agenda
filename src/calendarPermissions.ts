import type { Activity, AdminProfile } from './types'

export function canEditCalendarActivity(profile: AdminProfile | null, activity: Pick<Activity, 'turmaId'>): boolean {
  if (!profile) return false
  return profile.role === 'superadmin'
    || (profile.role === 'representante' && !!profile.turmaId && activity.turmaId === profile.turmaId)
}
