import { afterEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('./attachments', () => ({ ATTACHMENTS_ENABLED: false }))
import { LinkedActivityDetails } from './ActivityLinkDialog'
import { ActivityShareButton } from './ActivityShareButton'
import { setActivityDrafts } from './optimisticActivities'
import type { Activity } from './types'
import type { QueueView } from './writeQueue'
afterEach(() => setActivityDrafts([]))
const activity: Activity = { id: 'one', title: '<script>Entrega</script>', description: 'Parte 1\nParte 2', type: 'trabalho', subject: 'Desenvolvimento', date: '2026-11-10', time: '07:00', turmaId: '2° TECH E', createdByEmail: 'private@example.com' }
it('shows exact activity, class and deadline, escaping content and omitting private author data', () => {
  const html = renderToStaticMarkup(<LinkedActivityDetails activity={activity} />)
  for (const text of ['2° TECH E', '10 de novembro', '2026', '07:00', 'Desenvolvimento', 'Parte 1', 'Parte 2', 'Copiar link']) expect(html).toContain(text)
  expect(html).toContain('&lt;script&gt;Entrega&lt;/script&gt;')
  expect(html).not.toContain('<script>'); expect(html).not.toContain('private@example.com')
})
it('identifies global activities without requiring a class selection', () => {
  const html = renderToStaticMarkup(<LinkedActivityDetails activity={{ ...activity, turmaId: null, time: null }} />)
  expect(html).toContain('Geral · todas as turmas'); expect(html).toContain('Sem horário definido')
})
it('does not offer a shareable link before a newly queued activity has been confirmed', () => {
  setActivityDrafts([{ kind: 'activity-create', value: { id: 'one' }, confirmed: null } as QueueView])
  const html = renderToStaticMarkup(<ActivityShareButton activityId="one" />)
  expect(html).toContain('Aguardando salvar'); expect(html).toContain('disabled=""')
  expect(renderToStaticMarkup(<ActivityShareButton activityId="other" />)).not.toContain('disabled=""')
})
