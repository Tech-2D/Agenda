import { collection, doc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import type { RecurringActivity } from './types'

export async function deleteRecurrence(item: RecurringActivity) {
  const template = doc(db, 'recurringActivities', item.id)
  // Pause first; a failed cleanup remains visible and can safely be retried.
  await updateDoc(template, { active: false })
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const snapshot = await getDocs(query(collection(db, 'activities'), where('turmaId', '==', item.turmaId), where('recurringId', '==', item.id)))
  const future = snapshot.docs.filter(row => row.data().date >= today)
  for (let offset = 0; offset < future.length; offset += 200) {
    const batch = writeBatch(db)
    for (const row of future.slice(offset, offset + 200)) batch.delete(row.ref)
    await batch.commit()
  }
  // Keep a tombstone so background automation cannot revive this series.
  await updateDoc(template, { active: false, deleted: true })
}
