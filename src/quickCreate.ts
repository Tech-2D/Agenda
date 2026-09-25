import type { AdminProfile } from './types'

export function canCreateForSelectedClass(profile: AdminProfile | null, selectedClass: string | null): boolean {
  if (!selectedClass || !profile) return false
  return profile.role === 'superadmin' || (profile.role === 'representante' && profile.turmaId === selectedClass)
}
