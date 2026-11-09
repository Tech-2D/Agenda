import type { KanbanBoard } from './kanban'
export type SharedBoard = { ownerId:string; board:KanbanBoard; createdAt:unknown; updatedAt:unknown }
export type KanbanRequest = { id:string;boardId:string;userId:string;userEmail:string;name:string;status:'pending'|'approved'|'rejected'|'revoked';createdAt?:unknown;updatedAt?:unknown }
export type KanbanMember = { id:string;boardId:string;userId:string;userEmail:string;name:string;createdAt?:unknown }
export function kanbanInvite(hash:string) {
  if(hash.split('?')[0]!=='#kanban')return null
  const value=new URLSearchParams(hash.split('?')[1] || '').get('convite')
  return value && /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : null
}
export function sharedKanbanLink(base:string,boardId:string) {
  const url=new URL(base);url.hash='kanban?convite='+encodeURIComponent(boardId);return url.href
}
export function memberKey(boardId:string,userId:string) {return boardId+'_'+userId}
