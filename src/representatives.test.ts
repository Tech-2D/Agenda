import { expect, it } from 'vitest'
import { filterRepresentatives, type ApprovedRepresentative } from './representatives'

const items: ApprovedRepresentative[] = [
  { id: 'b', email: 'bia@example.com', turmaId: '3º TECH E', approvedAt: null },
  { id: 'a', email: 'ana@example.com', turmaId: '2º TECH D', approvedAt: null },
  { id: 'c', email: 'carlos@example.com', turmaId: '2ª Série B', approvedAt: null },
]

it('filters email and class without case or accent sensitivity', () => {
  expect(filterRepresentatives(items, ' ANA@EXAMPLE ')).toEqual([items[1]])
  expect(filterRepresentatives(items, 'serie')).toEqual([items[2]])
  expect(filterRepresentatives(items, 'TECH E')).toEqual([items[0]])
  expect(filterRepresentatives(items, 'ausente')).toEqual([])
})

it('sorts by class then email without changing the source', () => {
  const source = [...items]
  const sorted = filterRepresentatives(items, '')
  expect(sorted).toHaveLength(3)
  expect(sorted.at(-1)?.id).toBe('b')
  expect(items).toEqual(source)
  expect(filterRepresentatives([], '')).toEqual([])
})
