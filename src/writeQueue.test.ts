import {afterEach,expect,it,vi} from 'vitest'
import {WriteQueue,type QueueDocument} from './writeQueue'
const row=(path:string,n:number,version='1'):QueueDocument=>({path,id:path.split('/').at(-1)!,data:{n},version})
function setup(send?:((request:unknown)=>Promise<QueueDocument>)) {
  let session:object | null={uid:'one'}
  const transport=vi.fn(send || (async request=>{const r=request as {path:string;data:{n:number};version:string | null};return row(r.path,r.data.n,String(BigInt(r.version || 0)+1n))}))
  const queue=new WriteQueue({session:()=>session,prepare:(kind,path,data,base,id)=>({kind,path,data,id,version:base?.version || null}),send:transport,project:(kind,path,base,data)=>({...row(path,data.n as number),data:{...base?.data,...data},version:base?.version || null}),failure:e=>{const code=(e as {code?:string}).code || 'network';return {code,message:'Kept draft',retryable:code==='network'}},delay:async()=>{}})
  return {queue,transport,switch:()=>{session={uid:'two'};queue.clearSession()}}
}
afterEach(()=>vi.useRealTimers())
it('shows the draft synchronously, before the API finishes',async()=>{
  vi.useFakeTimers();let finish!:(value:QueueDocument)=>void
  const {queue,transport}=setup(()=>new Promise(resolve=>{finish=resolve}))
  queue.enqueue('key','shared','sharedKanban/a',row('sharedKanban/a',0),{n:1},'Save','1')
  expect(queue.get('key')?.value.data.n).toBe(1);expect(transport).not.toHaveBeenCalled()
  const done=queue.flush();expect(queue.get('key')?.sending).toBe(true)
  finish(row('sharedKanban/a',1,'2'));await done
  expect(queue.get('key')?.confirmed?.version).toBe('2');expect(queue.pending()).toHaveLength(0)
})
it('coalesces pending snapshots and chains the next confirmed version without losing rapid edits',async()=>{
  vi.useFakeTimers();let finish!:(value:QueueDocument)=>void
  const {queue,transport}=setup()
  transport.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  queue.enqueue('key','personal','personalKanban/one',row('personalKanban/one',0),{n:1},'One')
  const done=queue.flush()
  queue.enqueue('key','personal','personalKanban/one',row('personalKanban/one',0),{n:2},'Two')
  queue.enqueue('key','personal','personalKanban/one',row('personalKanban/one',0),{n:3},'Three')
  expect(queue.get('key')?.pending).toBe(2);expect(queue.get('key')?.value.data.n).toBe(3)
  finish(row('personalKanban/one',1,'2'));await done
  expect(transport).toHaveBeenCalledTimes(2)
  expect(transport.mock.calls[1][0]).toMatchObject({data:{n:3},version:'2'})
  expect(queue.get('key')?.confirmed?.data.n).toBe(3)
})
it('retries transport failures with exactly the same prepared request and idempotency ID',async()=>{
  vi.useFakeTimers();const {queue,transport}=setup()
  transport.mockRejectedValueOnce(TypeError('offline')).mockRejectedValueOnce(TypeError('offline'))
  queue.enqueue('key','shared','sharedKanban/a',row('sharedKanban/a',0),{n:1},'Save')
  await queue.flush()
  expect(transport).toHaveBeenCalledTimes(3)
  expect(transport.mock.calls[0][0]).toBe(transport.mock.calls[1][0]);expect(transport.mock.calls[1][0]).toBe(transport.mock.calls[2][0])
})
it('does not retry permissions or conflicts and preserves the unsaved draft for review',async()=>{
  vi.useFakeTimers();const {queue,transport}=setup()
  transport.mockRejectedValue(Object.assign(Error('Forbidden'),{code:'permission-denied'}))
  queue.enqueue('key','shared','sharedKanban/a',row('sharedKanban/a',0),{n:9},'Save')
  await queue.flush()
  expect(transport).toHaveBeenCalledTimes(1);expect(queue.get('key')?.value.data.n).toBe(9)
  expect(queue.get('key')?.failed?.code).toBe('permission-denied');expect(queue.retry('key')).toBe(false)
  expect(()=>queue.enqueue('key','shared','sharedKanban/a',row('sharedKanban/a',0),{n:10},'Save')).toThrow()
})
it('isolates a failed resource while allowing another document to finish',async()=>{
  vi.useFakeTimers();const {queue,transport}=setup()
  transport.mockRejectedValueOnce(Object.assign(Error('Conflict'),{code:'aborted'}))
  queue.enqueue('a','shared','sharedKanban/a',row('sharedKanban/a',0),{n:1},'A')
  queue.enqueue('b','shared','sharedKanban/b',row('sharedKanban/b',0),{n:2},'B')
  await queue.flush()
  expect(queue.get('a')?.failed?.code).toBe('aborted');expect(queue.get('b')?.confirmed?.data.n).toBe(2)
})
it('never starts an unsent job after the account changes or applies an old response to the new account',async()=>{
  vi.useFakeTimers();let finish!:(value:QueueDocument)=>void
  const api=setup(()=>new Promise(resolve=>{finish=resolve}))
  api.queue.enqueue('a','shared','sharedKanban/a',row('sharedKanban/a',0),{n:1},'A')
  api.queue.enqueue('b','shared','sharedKanban/b',row('sharedKanban/b',0),{n:2},'B')
  const done=api.queue.flush();api.switch();finish(row('sharedKanban/a',1,'2'));await done
  expect(api.transport).toHaveBeenCalledTimes(1);expect(api.queue.pending()).toEqual([]);expect(api.queue.get('a')).toBeUndefined()
})
it('does not rebase a stale editor against a newer background read',()=>{
  vi.useFakeTimers();const {queue}=setup()
  expect(()=>queue.enqueue('key','shared','sharedKanban/a',row('sharedKanban/a',0,'6'),{n:1},'Save','5')).toThrow('mudou')
  expect(queue.pending()).toEqual([])
})
it('keeps data immutable and refuses to discard an in-flight write',async()=>{
  vi.useFakeTimers();let finish!:(value:QueueDocument)=>void
  const {queue}=setup(()=>new Promise(resolve=>{finish=resolve})),data={n:1}
  queue.enqueue('key','shared','sharedKanban/a',row('sharedKanban/a',0),data,'Save');data.n=100
  expect(queue.get('key')?.value.data.n).toBe(1)
  const done=queue.flush();expect(queue.discard('key')).toBe(false);finish(row('sharedKanban/a',1,'2'));await done
  expect(queue.discard('key')).toBe(true)
})
