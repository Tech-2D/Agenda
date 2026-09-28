import { afterEach, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'
import { digestPreference } from './weeklyDigest'
const account = { getIdToken: vi.fn().mockResolvedValue('account-token') } as unknown as User
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })
it('saves only class and subscription, identifies account by token', async () => {
  const pref = { turmaId: '2° TECH D', enabled: true }
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => pref })
  vi.stubGlobal('fetch', fetch)
  expect(await digestPreference(account, pref)).toEqual(pref)
  const [url, options] = fetch.mock.calls[0]
  expect(url).toBe('https://tech-2d-auth-email.vercel.app/api/digest-preferences')
  expect(options.headers.Authorization).toBe('Bearer account-token')
  expect(JSON.parse(options.body)).toEqual(pref)
})
it('invalid class is rejected without network access', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  await expect(digestPreference(account, { turmaId: 'unknown', enabled: true })).rejects.toThrow('turma')
  expect(fetch).not.toHaveBeenCalled()
})
it('expired account and invalid server responses are not considered saved', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
  await expect(digestPreference(account)).rejects.toThrow('sessão expirou')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ turmaId: 'wrong', enabled: true }) }))
  await expect(digestPreference(account)).rejects.toThrow('Configuração inválida')
})
