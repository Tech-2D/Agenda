import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./firebase', () => ({ auth: { currentUser: null } }))
import { observeCatalog } from './publicQueries'

const response = (title = 'Tarefa', stale = false, generatedAt = '2026-09-30T10:00:00Z') => ({
  ok: true,
  json: async () => ({ activities: [{ title, updatedAt: '2026-09-30T09:00:00Z' }], meta: { generatedAt, stale } }),
})

let stop: (() => void) | undefined

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }))
  vi.stubGlobal('window', new EventTarget())
})

afterEach(() => {
  stop?.()
  stop = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('public catalog polling', () => {
  it('does not publish identical content again just because generation time changed', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response()).mockResolvedValue(response('Tarefa', false, '2026-09-30T10:01:00Z'))
    vi.stubGlobal('fetch', fetch)
    const change = vi.fn()
    stop = observeCatalog('agenda', change, vi.fn(), '2° TECH D')
    await vi.advanceTimersByTimeAsync(60000)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(change).toHaveBeenCalledTimes(1)
    expect(change.mock.calls[0][0].activities[0].updatedAt.toDate()).toEqual(new Date('2026-09-30T09:00:00Z'))
    expect((fetch.mock.calls[0][0] as URL).searchParams.get('class')).toBe('2° TECH D')
  })

  it('publishes changed activities and cache status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(response('Prova')).mockResolvedValue(response('Prova', true)))
    const change = vi.fn()
    stop = observeCatalog('agenda', change, vi.fn())
    await vi.advanceTimersByTimeAsync(120000)
    expect(change).toHaveBeenCalledTimes(3)
    expect(change.mock.calls[1][0].activities[0].title).toBe('Prova')
    expect(change.mock.calls[2][0].meta.stale).toBe(true)
  })

  it('publishes identical content after recovery so connection warnings can clear', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response()).mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response()))
    const change = vi.fn()
    const error = vi.fn()
    stop = observeCatalog('agenda', change, error)
    await vi.advanceTimersByTimeAsync(120000)
    expect(error).toHaveBeenCalledTimes(1)
    expect(change).toHaveBeenCalledTimes(2)
  })

  it('stops polling when the observer is removed', async () => {
    const fetch = vi.fn().mockResolvedValue(response())
    vi.stubGlobal('fetch', fetch)
    stop = observeCatalog('agenda', vi.fn(), vi.fn())
    await vi.advanceTimersByTimeAsync(0)
    stop()
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(120000)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
