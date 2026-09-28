import { describe, expect, it } from 'vitest'
import { filterFeedback, isFeedbackCompleted } from './feedbackStatus'
import type { Feedback } from './types'

const legacy: Feedback = { id: 'old', message: 'Melhoria', turmaId: null, createdAt: null }
const pending: Feedback = { ...legacy, id: 'pending', status: 'pending' }
const completed: Feedback = { ...legacy, id: 'completed', status: 'completed' }
describe('feedback completion', () => {
  it('keeps old suggestions pending without migration', () => {
    expect(isFeedbackCompleted(legacy)).toBe(false)
    expect(isFeedbackCompleted(pending)).toBe(false)
    expect(isFeedbackCompleted(completed)).toBe(true)
  })
  it('filters pending and completed without deleting items', () => {
    const items = [legacy, pending, completed]
    expect(filterFeedback(items, 'pending')).toEqual([legacy, pending])
    expect(filterFeedback(items, 'completed')).toEqual([completed])
    expect(filterFeedback(items, 'all')).toEqual(items)
    expect(items).toHaveLength(3)
  })
  it('puts reopened suggestions back in pending', () => {
    expect(filterFeedback([{ ...completed, status: 'pending', completedAt: null, completedBy: null }], 'pending')).toHaveLength(1)
  })
})
