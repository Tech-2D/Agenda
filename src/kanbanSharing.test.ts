import {expect,it} from 'vitest'
import {kanbanInvite,memberKey,sharedKanbanLink} from './kanbanSharing'
it('keeps invites in the Kanban route and rejects unexpected identifiers',()=>{
  expect(kanbanInvite('#kanban?convite=board_123')).toBe('board_123')
  expect(kanbanInvite('#admin?convite=board')).toBeNull()
  expect(kanbanInvite('#kanban?convite=..%2Fadmins')).toBeNull()
  expect(kanbanInvite('#kanban?convite='+ 'a'.repeat(81))).toBeNull()
  expect(kanbanInvite('#kanban')).toBeNull()
})
it('builds a link to the same site and a membership specific to the Firebase UID',()=>{
  const link=sharedKanbanLink('https://tech-2d.github.io/Agenda/#opcoes','board')
  expect(link).toBe('https://tech-2d.github.io/Agenda/#kanban?convite=board')
  expect(memberKey('board','user')).toBe('board_user')
})
