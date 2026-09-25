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
