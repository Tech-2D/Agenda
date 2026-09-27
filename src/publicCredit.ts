import type { Feedback } from './types'

export function isCreditEligible(item: Feedback): boolean {
  return item.publicCreditAllowed === true
    && typeof item.publicCreditName === 'string'
    && item.publicCreditName.trim().length > 0
    && !item.publicCreditName.includes('@')
}

export function creditForUpdate(item: Feedback) {
  if (!isCreditEligible(item)) throw new Error('Sugestão sem autorização de crédito público.')
  return { sourceFeedbackId: item.id, sourceName: item.publicCreditName!.trim(), sourceMessage: item.message }
}
