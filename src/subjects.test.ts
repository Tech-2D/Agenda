import { describe, expect, it } from 'vitest'
import { SUBJECTS } from './subjects'

describe('available subjects', () => {
  it('offers Educação Física once in every subject selector', () => {
    expect(SUBJECTS.filter(subject => subject === 'Educação Física')).toHaveLength(1)
  })
})
