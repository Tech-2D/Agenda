import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('./attachments', () => ({ ATTACHMENTS_ENABLED: true, formatAttachmentSize: () => '2 MB', attachmentDownloadUrl: vi.fn() }))
import { ActivityDetails } from './ActivityDetails'
import type { Activity } from './types'

const activity: Activity = { id: 'one', title: 'Trabalho de pipelines', type: 'trabalho', date: '2026-11-10', time: '07:00', subject: 'Desenvolvimento', turmaId: '2° TECH D', description: 'Leia as orientações.\nNão esqueça dos testes.\n\nEntregue no prazo.', createdByEmail: 'private@example.com' }
it('groups deadline, subject, class and the complete multiline instructions without exposing author data', () => {
  const html = renderToStaticMarkup(<ActivityDetails activity={activity} />)
  for (const text of ['Data da atividade', '10 de novembro de 2026', '07:00', 'Matéria', 'Desenvolvimento', 'Turma', '2° TECH D', 'Orientações', 'Leia as orientações.\nNão esqueça dos testes.', 'Entregue no prazo.', 'Copiar link']) expect(html).toContain(text)
  expect(html).not.toContain('private@example.com'); expect(html).not.toContain('Editar atividade')
})
it('labels missing fields explicitly and displays editing only when the caller authorizes it', () => {
  const html = renderToStaticMarkup(<ActivityDetails activity={{ ...activity, description: '', subject: null, turmaId: null, time: null }} onEdit={() => {}} />)
  for (const text of ['Sem horário definido', 'Não informada', 'Geral · todas as turmas', 'Não foram adicionadas orientações', 'Editar atividade']) expect(html).toContain(text)
})
it('separates downloadable materials and escapes file names without rendering storage paths', () => {
  const html = renderToStaticMarkup(<ActivityDetails activity={{ ...activity, recurringId: 'schedule', attachments: [{ id: 'file', name: '<script>Guia.pdf</script>', size: 2000000, contentType: 'application/pdf', storagePath: 'private-storage-key', uploadedAt: '2026-11-09T12:00:00Z' }] }} />)
  expect(html).toContain('Materiais e anexos'); expect(html).toContain('2 MB'); expect(html).toContain('Recorrente')
  expect(html).toContain('&lt;script&gt;Guia.pdf&lt;/script&gt;'); expect(html).not.toContain('private-storage-key'); expect(html).not.toContain('<script>')
})
