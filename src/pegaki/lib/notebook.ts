import type { User } from 'firebase/auth'
import { SQL_BASE } from '../../dataBackend'
import type { Grades } from '../components/SubjectRow'
import type { Modes } from './grades'

export type Notebook = { academicYear: number; gradeYear: number; version: number; grades: Record<string, Grades>; modes: Modes }
export class NotebookError extends Error {
  constructor(message: string, public status: number) { super(message) }
}
export async function notebookRequest(user: User, academicYear: number, gradeYear: number, draft?: Omit<Notebook,'academicYear'|'gradeYear'>): Promise<Notebook | null> {
  const token = await user.getIdToken()
  const response = await fetch(`${SQL_BASE}/api/pegaki?academicYear=${academicYear}&gradeYear=${gradeYear}`, {
    method: draft ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(draft ? { 'Content-Type': 'application/json' } : {}) },
    ...(draft ? { body: JSON.stringify({ academicYear, gradeYear, expectedVersion: draft.version, grades: draft.grades, modes: draft.modes }) } : {}),
    cache: 'no-store', signal: AbortSignal.timeout(20000),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new NotebookError(data.message || 'Não foi possível acessar as notas.', response.status)
  return data.notebook ?? null
}
