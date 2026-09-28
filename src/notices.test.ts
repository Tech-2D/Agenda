import { describe, expect, it } from 'vitest'
import { activeNotices, defaultNoticeExpiry, isNoticeActive, noticePurgeAt, sortNotices, validateNoticeDraft, type NoticeDraft } from './notices'

const NOW = new Date('2026-09-26T12:00:00Z')
const at = (iso: string) => ({ toDate: () => new Date(iso) })

describe('notices', () => {
  it('sorts urgent first, then newest within each type', () => {
    const sorted = sortNotices([
      { id: 'old-aviso', type: 'aviso' as const, createdAt: at('2026-09-01T00:00:00Z') },
      { id: 'new-lembrete', type: 'lembrete' as const, createdAt: at('2026-09-25T00:00:00Z') },
      { id: 'old-urgente', type: 'urgente' as const, createdAt: at('2026-08-01T00:00:00Z') },
      { id: 'new-aviso', type: 'aviso' as const, createdAt: at('2026-09-20T00:00:00Z') },
    ])
    expect(sorted.map((notice) => notice.id)).toEqual(['old-urgente', 'new-aviso', 'old-aviso', 'new-lembrete'])
  })

  it('hides expired notices and notices without a valid expiry', () => {
    const notices = [
      { id: 'ok', type: 'aviso' as const, createdAt: at('2026-09-20T00:00:00Z'), expiresAt: at('2026-10-01T00:00:00Z') },
      { id: 'expired', type: 'urgente' as const, createdAt: at('2026-09-20T00:00:00Z'), expiresAt: at('2026-09-26T11:59:59Z') },
      { id: 'missing', type: 'aviso' as const, createdAt: at('2026-09-20T00:00:00Z'), expiresAt: null },
    ]
    expect(activeNotices(notices, NOW).map((notice) => notice.id)).toEqual(['ok'])
    expect(isNoticeActive(notices[1], NOW)).toBe(false)
  })

  it('defaults the expiry to 30 days and purges 30 days after expiring', () => {
    expect(defaultNoticeExpiry(NOW).toISOString()).toBe('2026-10-26T12:00:00.000Z')
    expect(noticePurgeAt(new Date('2026-10-26T12:00:00Z')).toISOString()).toBe('2026-11-25T12:00:00.000Z')
  })

  it('validates the draft', () => {
    const draft: NoticeDraft = { title: ' Prova ', body: 'Trazer calculadora', type: 'aviso', expiresAt: defaultNoticeExpiry(NOW) }
    expect(validateNoticeDraft(draft, NOW)).toBeNull()
    expect(validateNoticeDraft({ ...draft, title: '  ' }, NOW)).toMatch(/título/)
    expect(validateNoticeDraft({ ...draft, title: 'x'.repeat(61) }, NOW)).toMatch(/60/)
    expect(validateNoticeDraft({ ...draft, body: 'x'.repeat(501) }, NOW)).toMatch(/500/)
    expect(validateNoticeDraft({ ...draft, expiresAt: new Date('2026-09-25T00:00:00Z') }, NOW)).toMatch(/futura/)
    expect(validateNoticeDraft({ ...draft, expiresAt: new Date('2028-01-01T00:00:00Z') }, NOW)).toMatch(/365/)
    expect(validateNoticeDraft({ ...draft, expiresAt: new Date('2026-09-01T00:00:00Z') }, NOW, false)).toBeNull()
  })
})
