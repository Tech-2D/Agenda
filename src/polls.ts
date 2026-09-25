export type Poll = {
  id: string
  turmaId: string
  question: string
  options: string[]
  status: 'open' | 'closed'
  createdBy: string
  createdAt?: { toDate: () => Date } | null
}

export type PollVote = {
  id: string
  optionIndex: number
}

export type PollVoterAccess = {
  id: string
  email: string
  turmaId: string
  status: 'pending' | 'approved' | 'rejected' | 'revoked'
  requestedAt?: { toDate: () => Date } | null
}

export function canVoteInClass(access: PollVoterAccess | null, turmaId: string, email: string | null): boolean {
  return access?.status === 'approved' && access.turmaId === turmaId && access.email === email?.toLowerCase()
}

export function countPollVotes(optionCount: number, votes: PollVote[]): number[] {
  const counts = Array.from({ length: optionCount }, () => 0)
  for (const vote of votes) {
    if (Number.isInteger(vote.optionIndex) && vote.optionIndex >= 0 && vote.optionIndex < optionCount) {
      counts[vote.optionIndex] += 1
    }
  }
  return counts
}

export function preparePollOptions(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean)
}
