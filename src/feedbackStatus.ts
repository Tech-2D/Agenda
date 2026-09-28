import type { Feedback } from './types'

export type FeedbackFilter = 'pending' | 'completed' | 'all'
export function isFeedbackCompleted(item: Feedback): boolean {
  return item.status === 'completed'
}
export function filterFeedback(items: Feedback[], filter: FeedbackFilter): Feedback[] {
  return items.filter(item => filter === 'all' || isFeedbackCompleted(item) === (filter === 'completed'))
}
