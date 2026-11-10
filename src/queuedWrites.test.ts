import {afterEach,beforeEach,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({account:{uid:'one'} as {uid:string}|null,known:null as unknown,send:vi.fn()}))
vi.mock('./firebase',()=>({auth:{get currentUser(){return mocks.account}}}))
vi.mock('./dataClient',()=>({SQL_ENABLED:true,knownDocument:()=>mocks.known,encodeDocumentData:(v:unknown)=>v,decodeDocumentData:(v:unknown)=>v,sendQueuedCommit:mocks.send,clearDataSession:vi.fn()}))
import {enqueueDocument,queuedDocument,queuedWrites,resetQueuedSession,pendingActivityStates} from './queuedWrites'
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('window',new EventTarget());mocks.account={uid:'one'};mocks.known=null;mocks.send.mockReset();resetQueuedSession()})
afterEach(()=>{resetQueuedSession();vi.useRealTimers();vi.unstubAllGlobals()})
it('creates a personal workspace once and chains the next snapshot as a versioned update',async()=>{
  let finish!:(value:unknown)=>void
  mocks.send.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValue({path:'personalKanban/one',id:'one',data:{ownerId:'one',schemaVersion:1,boards:['one','two'],createdAt:'2026-11-09T12:00:00Z'},version:'2'})
  const ref={path:'personalKanban/one'} as never
  enqueueDocument(ref,'personal',{boards:['one']},'Create')
  const done=queuedWrites.flush()
  enqueueDocument(ref,'personal',{boards:['one','two']},'Add')
  expect(queuedDocument(ref)?.pending).toBe(2)
  finish({path:'personalKanban/one',id:'one',data:{ownerId:'one',schemaVersion:1,boards:['one'],createdAt:'2026-11-09T12:00:00Z'},version:'1'})
  await done
  const first=mocks.send.mock.calls[0][0].commit.writes[0],second=mocks.send.mock.calls[1][0].commit.writes[0]
  expect(first.op).toBe('create');expect(first.data.ownerId).toBe('one')
  expect(second.op).toBe('update');expect(second.version).toBe('1');expect(second.data.createdAt).toBeUndefined()
  expect(queuedDocument(ref)?.value.data.boards).toEqual(['one','two'])
})
it('stages an activity immediately while keeping it separate from actual server confirmation',async()=>{
  const ref={path:'activities/id'} as never
  enqueueDocument(ref,'activity-create',{title:'New task',turmaId:'2° TECH D'},'Task')
  expect(pendingActivityStates()).toHaveLength(1);expect(mocks.send).not.toHaveBeenCalled()
  resetQueuedSession();expect(pendingActivityStates()).toHaveLength(0)
})
it('refuses personal workspaces owned by another Firebase account',()=>{
  expect(()=>enqueueDocument({path:'personalKanban/other'} as never,'personal',{boards:[]},'Save')).toThrow('outra conta')
  expect(mocks.send).not.toHaveBeenCalled()
})
it('queues an edit to a just-created activity after its creation is confirmed',async()=>{
  let finish!:(value:unknown)=>void
  const ref={path:'activities/new'} as never
  mocks.known=undefined
  mocks.send.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValue({path:'activities/new',id:'new',data:{title:'Edited'},version:'2'})
  enqueueDocument(ref,'activity-create',{title:'Original'},'Create')
  const done=queuedWrites.flush()
  enqueueDocument(ref,'activity-update',{title:'Edited'},'Edit')
  expect(queuedDocument(ref)?.value.data.title).toBe('Edited')
  finish({path:'activities/new',id:'new',data:{title:'Original'},version:'1'})
  await done
  const second=mocks.send.mock.calls[1][0].commit.writes[0]
  expect(second).toMatchObject({op:'update',version:'1',data:{title:'Edited'}})
  expect(queuedDocument(ref)?.pending).toBe(0)
})
