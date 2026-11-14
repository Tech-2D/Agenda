import { afterEach, expect, it, vi } from 'vitest'
const fetchCatalog = vi.hoisted(() => vi.fn())
vi.mock('./firebase', () => ({ auth: { currentUser: { getIdToken: async () => 'test-token' } } }))
vi.mock('./catalogTransport', () => ({ fetchCatalog }))
import { activityLink, loadLinkedActivity, readActivityLink } from './activityLinks'
afterEach(() => vi.resetAllMocks())

it('creates a stable direct link using only the ID, clearing unrelated query/hash data', () => {
  const url = activityLink('activity_123', 'https://tech-2d.github.io/Agenda/?email=private@example.com#admin')
  expect(url).toBe('https://tech-2d.github.io/Agenda/#atividade=activity_123')
  expect(readActivityLink(new URL(url).hash)).toBe('activity_123')
})
it('rejects malformed links and never treats other routes as activities', () => {
  for (const hash of ['#admin', '#kanban?convite=one', '#atividade=', '#atividade=a&atividade=b', '#atividade=a&class=other', '#atividade=..%2Fadmins%2Fowner', '#atividade=%00', '#atividade=' + 'a'.repeat(129)]) expect(readActivityLink(hash)).toBeNull()
  expect(() => activityLink('../admins/owner', 'https://example.com/')).toThrow()
})
it('loads the single public activity independently of the saved class or filters', async () => {
  const signal = new AbortController().signal
  fetchCatalog.mockResolvedValue(Response.json({ activity: { id: 'one', title: 'Entrega', turmaId: '2° TECH E' } }))
  expect((await loadLinkedActivity('one', signal))?.turmaId).toBe('2° TECH E')
  expect(fetchCatalog).toHaveBeenCalledWith('activities/one', undefined, signal, 'test-token')
})
it('distinguishes a removed activity from a service outage and refuses a mismatched response', async () => {
  const signal = new AbortController().signal
  fetchCatalog.mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(Response.json({ activity: { id: 'other', title: 'Other' } }))
  expect(await loadLinkedActivity('one', signal)).toBeNull()
  await expect(loadLinkedActivity('one', signal)).rejects.toThrow('Não foi possível carregar')
  await expect(loadLinkedActivity('one', signal)).rejects.toThrow('Resposta de atividade inválida')
})
