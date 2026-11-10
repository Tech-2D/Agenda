import * as native from 'firebase/firestore'
import { FirebaseError } from 'firebase/app'
import { auth } from './firebase'

// Cutover is explicit. A SQL failure must NEVER fall back to Firestore.
import { SQL_ENABLED, SQL_BASE } from './dataBackend'
export { SQL_ENABLED, SQL_BASE } from './dataBackend'

const CHANGED = 'tech2d-sql-data-changed'
type Constraint = { kind: 'filter' | 'order' | 'limit'; field?: string; op?: string; value?: unknown; direction?: string; limit?: number }
type Ref = { path: string; isCollection: boolean; constraints: Constraint[] }
export type DataRow = { path: string; id: string; data: Record<string, unknown>; version: string }
type Row = DataRow
type Write = { path: string; op: string; data?: unknown; merge?: boolean; version?: string }
const versions = new Map<string, string>()
const known = new Map<string,Row | null>()
const sessions=new WeakMap<object,string>()
let sessionCounter=0
export function dataSessionKey() {
  const account=auth.currentUser
  if(!account)return 'anonymous'
  if(!sessions.has(account))sessions.set(account,account.uid+':'+(++sessionCounter))
  return sessions.get(account)!
}
const key = (path: string) => dataSessionKey() + ':' + path
const reading=new Map<string,Promise<unknown>>()
let confirmationEpoch=0
const confirmedAt=new Map<string,number>()
const choose = <T>(original: T, implementation: unknown): T => SQL_ENABLED ? implementation as T : original
const asRef = (value: unknown) => value as Ref
function newId() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  while (id.length < 20) for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
    if (byte < 248 && id.length < 20) id += alphabet[byte % 62]
  }
  return id
}
function reference(isCollection: boolean, args: unknown[]): Ref & { id: string } {
  const parent = args[0] && typeof args[0] === 'object' && 'path' in args[0] ? asRef(args[0]).path : ''
  const suffix = args.slice(1).map(String).join('/')
  const path = [parent, suffix || (!isCollection ? newId() : '')].filter(Boolean).join('/')
  return {path, id: path.split('/').at(-1)!, isCollection, constraints: []}
}
function encode(value: unknown): unknown {
  if (value instanceof Date) return {__tech2dType:'timestamp',value:value.toISOString()}
  if (value instanceof native.Timestamp) return {__tech2dType:'timestamp',value:value.toDate().toISOString()}
  if (Array.isArray(value)) return value.map(encode)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]))
  if (value === undefined) throw new FirebaseError('invalid-argument','Há campos sem valor.')
  return value
}
function hydrate(value: unknown, field = ''): unknown {
  if (typeof value === 'string' && /At$/.test(field) && value.includes('T') && Number.isFinite(Date.parse(value))) return native.Timestamp.fromDate(new Date(value))
  if (Array.isArray(value)) return value.map(v=>hydrate(v))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,hydrate(v,k)]))
  return value
}
async function call(body: unknown, account = auth.currentUser) {
  if(auth.currentUser?.uid!==account?.uid)throw new FirebaseError('cancelled','A conta mudou. Tente novamente.')
  const token = await account?.getIdToken()
  if(auth.currentUser?.uid!==account?.uid)throw new FirebaseError('cancelled','A conta mudou. Tente novamente.')
  const response = await fetch(SQL_BASE + '/api/data',{
    method:'POST',headers:{'Content-Type':'application/json',...(token ? {Authorization:'Bearer ' + token} : {})},
    body:JSON.stringify(body),signal:AbortSignal.timeout(30000),redirect:'error',
  })
  // Never deliver a response belonging to the previous account.
  if (auth.currentUser?.uid !== account?.uid) throw new FirebaseError('cancelled','A conta mudou. Tente novamente.')
  const result = await response.json().catch(()=>({}))
  if (auth.currentUser?.uid !== account?.uid) throw new FirebaseError('cancelled','A conta mudou. Tente novamente.')
  if (!response.ok) throw new FirebaseError(result.code || 'unavailable',result.message || 'Serviço temporariamente indisponível.')
  return result
}
async function read(body:unknown) {
  const id=dataSessionKey()+':'+JSON.stringify(body)
  let request=reading.get(id)
  if(!request){const epoch=confirmationEpoch;request=call(body).then(result=>({...result,__clientReadEpoch:epoch}));reading.set(id,request)}
  try{return await request as Awaited<ReturnType<typeof call>>}
  finally{if(reading.get(id)===request)reading.delete(id)}
}
function snapshot(row: Row | null, ref: Ref) {
  if (row) versions.set(key(ref.path),row.version)
  else versions.delete(key(ref.path))
  known.set(key(ref.path),row)
  return {id:ref.path.split('/').at(-1),ref,exists:()=>Boolean(row),data:()=>row ? hydrate(row.data) : undefined}
}
async function getOne(ref: Ref) {
  const result=await read({action:'get',path:ref.path})
  const row=(confirmedAt.get(key(ref.path)) || 0)>result.__clientReadEpoch ? known.get(key(ref.path)) : result.document
  return snapshot(row ?? null,ref)
}
async function getMany(ref: Ref) {
  const constraints=ref.constraints || []
  const filters=constraints.filter(c=>c.kind==='filter').map(c=>({field:c.field,op:c.op,value:c.value}))
  const order=constraints.filter(c=>c.kind==='order').map(c=>({field:c.field,direction:c.direction}))
  const maximum=constraints.find(c=>c.kind==='limit')?.limit
  const result=await read({action:'query',query:{path:ref.path,filters,order,...(maximum === undefined ? {} : {limit:maximum})}})
  const rows:Row[]=result.documents.map((row:Row)=>(confirmedAt.get(key(row.path)) || 0)>result.__clientReadEpoch ? known.get(key(row.path)) : row).filter(Boolean)
  const docs=rows.map(row=>snapshot(row,{...ref,path:row.path,isCollection:false}))
  return {docs,size:docs.length,empty:!docs.length,forEach:(fn:(row:unknown)=>void)=>docs.forEach(fn)}
}
async function commit(writes: Write[]) {
  const input={action:'commit',commit:{id:crypto.randomUUID(),writes,returnDocuments:true}}
  const account=auth.currentUser
  let result
  // Keep the same ID when transport fails: the server receipt prevents duplicate writes.
  try {result=await call(input,account)} catch(error) {
    if (error instanceof FirebaseError) throw error
    result=await call(input,account)
  }
  for (const write of writes) versions.delete(key(write.path))
  acceptConfirmation(result,writes.map(w=>w.path))
}
function acceptConfirmation(result:{documents?:Row[];deleted?:string[]},paths:string[]) {
  const epoch=++confirmationEpoch
  for(const row of result.documents || []){known.set(key(row.path),row);versions.set(key(row.path),row.version);confirmedAt.set(key(row.path),epoch)}
  for(const path of result.deleted || []){known.set(key(path),null);versions.delete(key(path));confirmedAt.set(key(path),epoch)}
  window.dispatchEvent(new CustomEvent(CHANGED,{detail:{paths}}))
}
export function knownDocument(ref:native.DocumentReference){return known.get(key(asRef(ref).path))}
export function clearDataSession(){known.clear();versions.clear();confirmedAt.clear();reading.clear()}
export function decodeDocumentData<T>(value:unknown):T{return hydrate(value) as T}
export function encodeDocumentData(value:unknown):Record<string,unknown>{return encode(value) as Record<string,unknown>}
export async function sendQueuedCommit(body:{action:string;commit:{id:string;writes:Write[];returnDocuments:boolean}},account:typeof auth.currentUser):Promise<Row> {
  const result=await call(body,account),write=body.commit.writes[0]
  let row:Row | undefined=result.documents?.find((r:Row)=>r.path===write.path)
  if(!row) {
    row=(await call({action:'get',path:write.path},account)).document
    // A replay may have been followed by another editor. Never adopt its version for queued drafts.
    const expected=String(BigInt(write.version || 0)+1n)
    if(!row || row.version!==expected)throw new FirebaseError('aborted','O documento mudou. Revise as alterações pendentes.')
  }
  acceptConfirmation({documents:[row]},[write.path])
  return row
}
export async function getKanbanMembers(boardId:string):Promise<{uid:string;name:string}[]> {
  return (await read({action:'members',path:'sharedKanban/'+boardId})).members
}
function write(op: string, ref: Ref, data?: unknown, options?: {merge?: boolean}): Write {
  return {op,path:ref.path,...(data === undefined ? {} : {data:encode(data)}),...(options ? {merge:options.merge === true} : {}),...(versions.has(key(ref.path)) && ['update','delete'].includes(op) ? {version:versions.get(key(ref.path))} : {})}
}
export const doc = choose(native.doc,(...args: unknown[])=>reference(false,args))
export const collection = choose(native.collection,(...args: unknown[])=>reference(true,args))
export const query = choose(native.query,(ref: Ref,...constraints: Constraint[])=>({...ref,constraints:[...ref.constraints,...constraints]}))
export const where = choose(native.where,(field:string,op:string,value:unknown)=>({kind:'filter',field,op,value}))
export const orderBy = choose(native.orderBy,(field:string,direction='asc')=>({kind:'order',field,direction}))
export const limit = choose(native.limit,(maximum:number)=>({kind:'limit',limit:maximum}))
export const serverTimestamp = choose(native.serverTimestamp,()=>({__tech2dType:'serverTimestamp'}))
export const getDoc = choose(native.getDoc,getOne)
export const getDocs = choose(native.getDocs,getMany)
export const addDoc = choose(native.addDoc,async(ref:Ref,data:unknown)=>{
  const target=reference(false,[ref])
  await commit([write('create',target,data)])
  return target
})
export const setDoc = choose(native.setDoc,(ref:Ref,data:unknown,options?:{merge?:boolean})=>commit([write('set',ref,data,options)]))
export const updateDoc = choose(native.updateDoc,(ref:Ref,data:unknown)=>commit([write('update',ref,data)]))
export const deleteDoc = choose(native.deleteDoc,(ref:Ref)=>commit([write('delete',ref)]))
// Shared editors pin the version they opened, even if background reads see a newer one.
export function documentVersion(ref: native.DocumentReference): string | null {
  return versions.get(key(asRef(ref).path)) || null
}
export async function updateDocAtVersion(ref: native.DocumentReference, data: unknown, version: string) {
  if (!SQL_ENABLED || !/^[1-9]\d*$/.test(version)) throw new FirebaseError('failed-precondition','Recarregue o quadro antes de salvar.')
  await commit([{op:'update',path:asRef(ref).path,data:encode(data),version}])
}
export const writeBatch = choose(native.writeBatch,()=>{
  const writes:Write[]=[]
  const batch={
    set:(ref:Ref,data:unknown,options?:{merge?:boolean})=>{writes.push(write('set',ref,data,options));return batch},
    update:(ref:Ref,data:unknown)=>{writes.push(write('update',ref,data));return batch},
    delete:(ref:Ref)=>{writes.push(write('delete',ref));return batch},
    commit:()=>commit(writes),
  }
  return batch
})
export const onSnapshot = choose(native.onSnapshot,(ref:Ref,next:(value:unknown)=>void,error?:(value:unknown)=>void)=>{
  let stopped=false,running=false,last='',timer:ReturnType<typeof setTimeout>
  const refresh=async()=>{
    if(stopped || running || document.hidden) return
    running=true;clearTimeout(timer)
    try {
      const value=await (ref.isCollection ? getMany(ref) : getOne(ref))
      const content=JSON.stringify(ref.isCollection ? (value as Awaited<ReturnType<typeof getMany>>).docs.map(d=>d.data()) : (value as Awaited<ReturnType<typeof getOne>>).data())
      if(!stopped && content !== last) {next(value);last=content}
    } catch(cause) {if(!stopped) error?.(cause)}
    finally {running=false;if(!stopped) timer=setTimeout(()=>void refresh(),30000)}
  }
  const wake=(event:Event)=>{
    const paths=(event as CustomEvent<{paths?:string[]}>).detail?.paths
    if(paths && !paths.some(path=>ref.isCollection ? path.slice(0,path.lastIndexOf('/'))===ref.path : path===ref.path))return
    void refresh()
  }
  window.addEventListener(CHANGED,wake)
  document.addEventListener('visibilitychange',wake)
  void refresh()
  return ()=>{stopped=true;clearTimeout(timer);window.removeEventListener(CHANGED,wake);document.removeEventListener('visibilitychange',wake)}
})
export { Timestamp } from 'firebase/firestore'
