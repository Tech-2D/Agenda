import type { User } from 'firebase/auth'
import { CLASS_NAMES } from './classNames'

export type DigestPreference = { turmaId: string | null; enabled: boolean }
const ENDPOINT = 'https://tech-2d-auth-email.vercel.app/api/digest-preferences'
export async function digestPreference(user: User, preference?: DigestPreference): Promise<DigestPreference> {
  if (preference && (!(CLASS_NAMES as readonly string[]).includes(preference.turmaId || '') || typeof preference.enabled !== 'boolean')) throw new Error('Escolha sua turma.')
  const response = await fetch(ENDPOINT, {
    method: preference ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(preference ? { 'Content-Type': 'application/json' } : {}) },
    ...(preference ? { body: JSON.stringify(preference) } : {}),
  })
  if (!response.ok) throw new Error(response.status === 401 ? 'Sua sessão expirou. Entre novamente.' : 'Não foi possível acessar a configuração. Tente novamente.')
  const data = await response.json() as DigestPreference
  if (typeof data.enabled !== 'boolean' || (data.turmaId !== null && !(CLASS_NAMES as readonly string[]).includes(data.turmaId))) throw new Error('Configuração inválida. Tente novamente.')
  return data
}
