import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ update: vi.fn(), list: vi.fn(), commit: vi.fn(), remove: vi.fn() }))
vi.mock('./firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: (_: unknown, collection: string, id: string) => ({ collection, id }),
  collection: vi.fn(), query: vi.fn(), where: vi.fn(),
  updateDoc: mocks.update, getDocs: mocks.list,
  writeBatch: () => ({ delete: mocks.remove, commit: mocks.commit }),
}))
import { deleteRecurrence } from './deleteRecurrence'
import type { RecurringActivity } from './types'
const item = { id: 'series', turmaId: '2° TECH D' } as RecurringActivity
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-05T01:00:00Z')) // Still October 4 in Brasília.
  mocks.update.mockResolvedValue(undefined)
  mocks.commit.mockResolvedValue(undefined)
})
it('pauses before removing today and future occurrences, preserving past history', async () => {
  mocks.list.mockResolvedValue({ docs: ['2026-10-03', '2026-10-04', '2026-10-05'].map(date => ({ ref: date, data: () => ({ date }) })) })
  await deleteRecurrence(item)
  expect(mocks.update.mock.calls.map(call => call[1])).toEqual([{ active: false }, { active: false, deleted: true }])
  expect(mocks.remove.mock.calls.flat()).toEqual(['2026-10-04', '2026-10-05'])
  expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.list.mock.invocationCallOrder[0])
  expect(mocks.commit.mock.invocationCallOrder[0]).toBeLessThan(mocks.update.mock.invocationCallOrder[1])
})
it('bounds batch size for long-running series', async () => {
  mocks.list.mockResolvedValue({ docs: Array.from({ length: 401 }, (_, ref) => ({ ref, data: () => ({ date: '2026-10-05' }) })) })
  await deleteRecurrence(item)
  expect(mocks.commit).toHaveBeenCalledTimes(3)
  expect(mocks.remove).toHaveBeenCalledTimes(401)
})
it('keeps a failed cleanup paused and visible for retry', async () => {
  mocks.list.mockResolvedValue({ docs: [{ ref: 'today', data: () => ({ date: '2026-10-04' }) }] })
  mocks.commit.mockRejectedValueOnce(new Error('quota'))
  await expect(deleteRecurrence(item)).rejects.toThrow('quota')
  expect(mocks.update).toHaveBeenCalledTimes(1)
  expect(mocks.update.mock.calls[0][1]).toEqual({ active: false })
})
it('does not remove anything if pausing fails', async () => {
  mocks.update.mockRejectedValueOnce(new Error('permission'))
  await expect(deleteRecurrence(item)).rejects.toThrow('permission')
  expect(mocks.list).not.toHaveBeenCalled()
  expect(mocks.remove).not.toHaveBeenCalled()
})
