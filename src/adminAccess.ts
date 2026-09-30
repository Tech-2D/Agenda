import { type User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { CLASS_NAMES } from './classNames'
import { type AdminProfile } from './types'
import { normalizeRepresentativeEmail } from './representativeAccess'

export async function loadOrClaimAdminProfile(account: User): Promise<AdminProfile | null> {
  const adminRecord = await getDoc(doc(db, 'admins', account.uid))
  const profile = adminRecord.data() as AdminProfile | undefined
  if (profile?.role === 'representante' || profile?.role === 'superadmin') return profile
  if (adminRecord.exists() || !account.email) return null

  const email = normalizeRepresentativeEmail(account.email)
  const invite = await getDoc(doc(db, 'representativeInvites', email))
  const turmaId = invite.data()?.turmaId
  if (!invite.exists() || invite.data()?.email !== email || !(await isAvailableClass(turmaId))) return null

  await setDoc(doc(db, 'admins', account.uid), { role: 'representante', turmaId, createdAt: serverTimestamp() })
  return { role: 'representante', turmaId }
}

async function isAvailableClass(name: unknown): Promise<boolean> {
  if (typeof name !== 'string') return false
  if ((CLASS_NAMES as readonly string[]).includes(name)) return true
  const snapshot = await getDoc(doc(db, 'agendaClasses', name))
  return snapshot.exists() && snapshot.data().active === true && snapshot.data().name === name
}
