import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'

it('keeps class filters and existing activity and Kanban links on the old Agenda path', () => {
  const source = readFileSync('public/legacyRedirect.js', 'utf8')
  for (const base of ['/', '/web/']) {
    for (const hash of ['#atividade=activity_123', '#kanban?convite=board', '#menu=notifications', '#admin']) {
      const replace = vi.fn()
      const document = { currentScript: { src: `https://tech-2d.github.io${base}legacyRedirect.js` } }
      runInNewContext(source, { URL, document, window: { location: { search: '?turma=2D', hash, replace } } })
      expect(replace).toHaveBeenCalledWith(`https://tech-2d.github.io${base}?turma=2D${hash}`)
    }
  }
})
