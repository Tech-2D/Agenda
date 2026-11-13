import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'

it('keeps class filters and existing activity and Kanban links on the old Agenda path', () => {
  const source = readFileSync('public/legacyRedirect.js', 'utf8')
  for (const hash of ['#atividade=activity_123', '#kanban?convite=board', '#menu=notifications', '#admin']) {
    const replace = vi.fn()
    runInNewContext(source, { URL, window: { location: { origin: 'https://tech-2d.github.io', search: '?turma=2D', hash, replace } } })
    expect(replace).toHaveBeenCalledWith(`https://tech-2d.github.io/?turma=2D${hash}`)
  }
})
