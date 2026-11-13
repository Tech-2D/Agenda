import { describe, expect, it, vi } from 'vitest'

describe.each(['/', '/web/'])('painel publicado em %s', base => {
  it('preserva o acesso direto e encaminha os links antigos para a página certa', async () => {
    vi.stubEnv('BASE_URL', base)
    vi.resetModules()
    try {
      const { isAdminRoute, legacyAdminUrl } = await import('./adminRoute')
      expect(isAdminRoute(`${base}admin/`)).toBe(true)
      expect(isAdminRoute(`${base}admin`)).toBe(true)
      expect(isAdminRoute(`${base}admin/extra`)).toBe(false)
      expect(legacyAdminUrl({ pathname: base, hash: '#admin', search: '' })).toBe(`${base}admin/`)
      expect(legacyAdminUrl({ pathname: base, hash: '#representante', search: '?turma=2D' })).toBe(`${base}admin/?turma=2D&acesso=solicitar`)
      expect(legacyAdminUrl({ pathname: `${base}professores/`, hash: '#admin', search: '' })).toBeNull()
    } finally {
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })
})
