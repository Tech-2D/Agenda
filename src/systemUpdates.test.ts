import { describe, expect, it } from 'vitest'
import { latestUnseenUpdate, type SystemUpdate } from './systemUpdates'

const updates: SystemUpdate[] = [
  { id: 'new', title: 'Nova função', body: 'Detalhes', createdBy: 'admin' },
  { id: 'old', title: 'Correção', body: 'Detalhes antigos', createdBy: 'admin' },
]

describe('latestUnseenUpdate', () => {
  it('shows only the newest publication when it has not been seen', () => {
    expect(latestUnseenUpdate(updates, 'old')?.id).toBe('new')
    expect(latestUnseenUpdate(updates, null)?.id).toBe('new')
  })

  it('does not reopen an update already seen or show an empty history', () => {
    expect(latestUnseenUpdate(updates, 'new')).toBeNull()
    expect(latestUnseenUpdate([], null)).toBeNull()
  })
})
