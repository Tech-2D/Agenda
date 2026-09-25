import { describe, expect, it } from 'vitest'
import { canVoteInClass, countPollVotes, preparePollOptions, type PollVoterAccess } from './polls'

describe('polls', () => {
  it('counts each valid choice and ignores malformed votes', () => {
    expect(countPollVotes(3, [
      { id: 'a', optionIndex: 0 },
      { id: 'b', optionIndex: 2 },
      { id: 'c', optionIndex: 2 },
      { id: 'd', optionIndex: -1 },
      { id: 'e', optionIndex: 4 },
    ])).toEqual([1, 0, 2])
  })

  it('trims choices and removes empty ones', () => {
    expect(preparePollOptions([' Sim ', ' ', 'Não'])).toEqual(['Sim', 'Não'])
  })

  it('only accepts an approved voter for the matching class and email', () => {
    const access: PollVoterAccess = { id: 'uid', email: 'aluno@exemplo.com', turmaId: '2° TECH D', status: 'approved' }
    expect(canVoteInClass(access, '2° TECH D', 'aluno@exemplo.com')).toBe(true)
    expect(canVoteInClass(access, '2° TECH E', 'aluno@exemplo.com')).toBe(false)
    expect(canVoteInClass({ ...access, status: 'revoked' }, '2° TECH D', 'aluno@exemplo.com')).toBe(false)
  })
})
