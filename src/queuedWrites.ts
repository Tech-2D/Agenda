import type { DocumentReference } from 'firebase/firestore'
import { auth } from './firebase'
import { clearDataSession, decodeDocumentData, encodeDocumentData, knownDocument, sendQueuedCommit, SQL_ENABLED, type DataRow } from './dataClient'
import { WriteQueue, type QueueDocument, type QueueFailure, type QueueKind, type QueueView } from './writeQueue'
import { QUEUED_CHANGED, setActivityDrafts } from './optimisticActivities'
export { QUEUED_CHANGED, mergeQueuedActivities, pendingActivityStates } from './optimisticActivities'

const stamp={__tech2dType:'serverTimestamp'}
let sessionOwner:string | null=null,sessionValue:{uid:string} | null=null
function currentSession(){const uid=auth.currentUser?.uid || null;if(uid!==sessionOwner){sessionOwner=uid;sessionValue=uid ? {uid} : null}return sessionValue}
const queueError=(code:string,message:string)=>Object.assign(Error(message),{code})
function fail(error:unknown):QueueFailure {
  const code=typeof (error as {code?:unknown})?.code==='string' ? (error as {code:string}).code : 'network'
  const retryable=['network','unavailable','deadline-exceeded','resource-exhausted'].includes(code)
  const message=code==='aborted' ? 'Outra pessoa alterou estes dados. Copie seu rascunho e recarregue para revisar.' : code==='permission-denied' ? 'Sem permissão para salvar. Seu rascunho foi mantido nesta página.' : code==='unauthenticated' || code==='cancelled' ? 'Confira seu login. Copie o rascunho antes de trocar de conta.' : retryable ? 'Envio interrompido. Mantenha a página aberta e tente novamente.' : 'Não foi possível salvar. O rascunho foi mantido para revisão.'
  return {code,message,retryable}
}
function localValues(value:unknown,now:string):unknown {
  if(Array.isArray(value))return value.map(v=>localValues(v,now))
  if(value && typeof value==='object') {
    const v=value as Record<string,unknown>
    if(v.__tech2dType==='serverTimestamp')return now
    if(v.__tech2dType==='timestamp')return v.value
    return Object.fromEntries(Object.entries(v).map(([k,item])=>[k,localValues(item,now)]))
  }
  return value
}
function project(kind:QueueKind,path:string,base:QueueDocument | null,data:Record<string,unknown>):QueueDocument {
  const now=new Date().toISOString(),value=localValues(data,now) as Record<string,unknown>
  const fields=kind==='personal' ? {...base?.data,ownerId:path.split('/')[1],schemaVersion:1,boards:value.boards,createdAt:base?.data.createdAt || now,updatedAt:now} : kind==='shared' ? {...base?.data,board:value.board,updatedAt:now} : {...base?.data,...value}
  return {path,id:path.split('/').at(-1)!,data:fields,version:base?.version ?? null}
}
export const queuedWrites=new WriteQueue({
  session:currentSession,
  project,failure:fail,
  prepare:(kind,path,data,base,id)=>{
    const create=(kind==='activity-create' || kind==='personal') && !base
    if(!create && !base?.version)throw queueError('failed-precondition','Recarregue os dados antes de salvar.')
    const fields=kind==='personal' ? {...(!base ? {ownerId:path.split('/')[1],schemaVersion:1,createdAt:stamp} : {}),boards:data.boards,updatedAt:stamp} : kind==='shared' ? {board:data.board,updatedAt:stamp} : data
    return {action:'commit',commit:{id,returnDocuments:true,writes:[{path,op:create ? 'create' : 'update',data:fields,...(!create ? {version:base!.version} : {})}]}}
  },
  send:(request,session)=>{
    if(auth.currentUser?.uid!==(session as {uid:string}).uid)throw queueError('cancelled','A conta mudou.')
    return sendQueuedCommit(request as Parameters<typeof sendQueuedCommit>[0],auth.currentUser)
  },
  changed:path=>{setActivityDrafts(queuedWrites.pending());if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(QUEUED_CHANGED,{detail:{path}}))},
})
export const queuedKey=(ref:DocumentReference)=>(auth.currentUser?.uid || 'anonymous')+':'+ref.path
export function queuedDocument(ref:DocumentReference){return queuedWrites.get(queuedKey(ref))}
export function seedQueuedDocument(ref:DocumentReference,kind:QueueKind) {
  const row=knownDocument(ref)
  if(row!==undefined)queuedWrites.seed(queuedKey(ref),kind,ref.path,row)
}
export function subscribeQueuedDocument(ref:DocumentReference,change:(state:QueueView)=>void) {
  let previous:QueueView | undefined
  const publish=()=>{const state=queuedDocument(ref);if(state && state!==previous){previous=state;change(state)}}
  const stop=queuedWrites.subscribe(publish);publish();return stop
}
export function enqueueDocument(ref:DocumentReference,kind:QueueKind,data:unknown,label:string,expectedVersion?:string | null) {
  if(!SQL_ENABLED || !auth.currentUser)throw queueError('unauthenticated','Entre novamente para salvar.')
  if(kind==='personal' && ref.path!=='personalKanban/'+auth.currentUser.uid)throw queueError('permission-denied','Quadro de outra conta.')
  const prefix=kind==='shared' ? 'sharedKanban/' : kind.startsWith('activity') ? 'activities/' : 'personalKanban/'
  if(!ref.path.startsWith(prefix))throw queueError('invalid-argument','Tipo de alteração inválido.')
  const base=kind==='activity-create' ? null : knownDocument(ref)
  if(base===undefined && !queuedDocument(ref)?.pending)throw queueError('failed-precondition','Recarregue antes de salvar.')
  queuedWrites.enqueue(queuedKey(ref),kind,ref.path,base || null,encodeDocumentData(data),label,expectedVersion)
}
export function resetQueuedSession(){sessionOwner=null;sessionValue=null;queuedWrites.clearSession();clearDataSession();setActivityDrafts([]);if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(QUEUED_CHANGED,{detail:{reset:true}}))}
export function queuedViewData<T>(state:QueueView):T{return decodeDocumentData<T>(state.value.data)}
export function confirmedQueuedRow(state:QueueView):DataRow | null {return state.confirmed as DataRow | null}
