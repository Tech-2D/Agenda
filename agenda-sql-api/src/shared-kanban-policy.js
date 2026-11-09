import {validKanban} from './kanban-policy.js'
const keys=(d,names)=>d && typeof d==='object' && !Array.isArray(d) && Object.keys(d).length===names.length && names.every(k=>Object.hasOwn(d,k))
const text=(v,max)=>typeof v==='string' && v.length>0 && v.length<=max
const id=v=>typeof v==='string' && /^[a-zA-Z0-9_-]{1,80}$/.test(v)
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
export const membershipPath=(boardId,uid)=>'kanbanMemberships/'+boardId+'_'+uid
export const requestPath=(boardId,uid)=>'kanbanRequests/'+boardId+'_'+uid
export async function sharedAccess(c,boardId) {
  if(!c.user || c.service || !id(boardId))return false
  const board=await c.get('sharedKanban/'+boardId)
  if(!board)return false
  if(board.ownerId===c.user.uid)return true
  const member=await c.get(membershipPath(boardId,c.user.uid))
  return member?.boardId===boardId && member.userId===c.user.uid
}
export async function canReadShared(c,name,id,data) {
  if(!c.user || c.service)return false
  if(name==='sharedKanban')return sharedAccess(c,id)
  if(!data)return id.endsWith('_'+c.user.uid)
  return Boolean(data && (data.userId===c.user.uid || (await c.get('sharedKanban/'+data.boardId))?.ownerId===c.user.uid))
}
export async function canQueryShared(c,name,q) {
  if(!c.user || c.service || q.limit>100)return false
  const eq=(field,value)=>q.filters.some(f=>f.field===field && f.op==='==' && f.value===value)
  if(name==='sharedKanban')return eq('ownerId',c.user.uid)
  if(eq('userId',c.user.uid))return true
  const boardId=q.filters.find(f=>f.field==='boardId' && f.op==='==')?.value
  return id(boardId) && (await c.get('sharedKanban/'+boardId))?.ownerId===c.user.uid
}
export async function canWriteShared(c,name,docId,old,d) {
  if(!c.user || c.service)return false
  const uid=c.user.uid,now=c.now
  if(name==='sharedKanban') {
    if(!d)return Boolean(old && old.ownerId===uid)
    if(!keys(d,['ownerId','board','createdAt','updatedAt']) || !id(docId) || !text(d.ownerId,128) || d.board?.id!==docId || d.updatedAt!==now
      || !validKanban({ownerId:d.ownerId,schemaVersion:1,boards:[d.board],createdAt:d.createdAt,updatedAt:d.updatedAt}))return false
    return old ? await sharedAccess(c,docId) && d.ownerId===old.ownerId && d.createdAt===old.createdAt : d.ownerId===uid && d.createdAt===now
  }
  const record=d || old
  if(!record || !id(record.boardId) || !text(record.userId,128) || docId!==record.boardId+'_'+record.userId)return false
  const board=await c.get('sharedKanban/'+record.boardId)
  if(!board)return false
  const owner=board.ownerId===uid
  if(name==='kanbanMemberships') {
    if(!d)return Boolean(old && (owner || old.userId===uid))
    const request=await c.get(requestPath(d.boardId,d.userId))
    return !old && owner && d.userId!==uid && keys(d,['boardId','userId','userEmail','name','createdAt']) && d.createdAt===now
      && request && ['pending','approved'].includes(request.status) && request.userId===d.userId && request.boardId===d.boardId && request.userEmail===d.userEmail && request.name===d.name
  }
  if(name==='kanbanRequests') {
    if(!d || !keys(d,['boardId','userId','userEmail','name','status','createdAt','updatedAt']) || d.updatedAt!==now || !text(d.name,80) || !text(d.userEmail,254))return false
    if(!old)return d.userId===uid && !owner && d.userEmail===c.user.email && d.status==='pending' && d.createdAt===now && !await c.get(membershipPath(d.boardId,uid))
    if(!same({...old,status:null,updatedAt:null},{...d,status:null,updatedAt:null}))return false
    if(owner)return ['approved','rejected','revoked'].includes(d.status)
    if(d.userId===uid && d.status==='revoked' && old.status==='approved')return Boolean(await c.get(membershipPath(d.boardId,uid)))
    return d.userId===uid && d.status==='pending' && old.status!=='pending' && !await c.get(membershipPath(d.boardId,uid))
  }
  return false
}
