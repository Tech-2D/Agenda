import { describe, expect, it } from 'vitest'
import { countPollVotes, preparePollOptions } from './polls'

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
})
