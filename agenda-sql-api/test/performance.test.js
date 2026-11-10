import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {createHandler} from '../src/worker.js'
import {putDocument} from '../src/document-store.js'
const engine=new PGlite()
for(const file of ['001_initial','002_application'])await engine.exec(await readFile(new URL('../migrations/'+file+'.sql',import.meta.url),'utf8'))
after(()=>engine.close())
let queries=0
const db={query:(sql,params)=>{queries++;return engine.query(sql,params)},end:async()=>{}}
await engine.query('UPDATE tech2d.migration_state SET application_seeded=true,production_enabled=true WHERE id=true')
await putDocument(db,'admins/owner',{role:'superadmin'})
await putDocument(db,'personalKanban/owner',{ownerId:'owner',schemaVersion:1,boards:[],createdAt:'2026-11-09T12:00:00Z',updatedAt:'2026-11-09T12:00:00Z'})
await putDocument(db,'sharedKanban/board',{ownerId:'owner',board:{id:'board',name:'Group',color:'blue',compact:false,columns:[{id:'todo',name:'To do',color:'blue',done:false}],tasks:[]},createdAt:'2026-11-09T12:00:00Z',updatedAt:'2026-11-09T12:00:00Z'})
const env={APPLICATION_DATA_ENABLED:'true',APPLICATION_WRITES_ENABLED:'true',MIGRATION_READY:'true'}
const handler=createHandler({connect:async()=>db,verify:async()=>({uid:'owner',email:'owner@example.com'})})
const request=path=>new Request('https://example.com/api/data',{method:'POST',headers:{Origin:'https://tech-2d.github.io',Authorization:'Bearer verified-test','Content-Type':'application/json'},body:JSON.stringify({action:'get',path})})
test('private reads combine the state/profile lookup and do not cache access across requests',async()=>{
  queries=0
  assert.equal((await handler(request('personalKanban/owner'),env)).status,200)
  assert.equal(queries,2)
  queries=0
  assert.equal((await handler(request('sharedKanban/board'),env)).status,200)
  assert.equal(queries,2)
  const stranger=createHandler({connect:async()=>db,verify:async()=>({uid:'stranger',email:'stranger@example.com'})})
  assert.equal((await stranger(request('sharedKanban/board'),env)).status,403)
})
test('public agenda uses one bounded SQL query and preserves public response shape',async()=>{
  await putDocument(db,'activities/activity',{title:'Entrega',description:'Teste',type:'tarefa',subject:null,time:null,date:'2026-11-10',turmaId:'2° TECH D',createdBy:'owner',createdByEmail:'private@example.com',createdAt:'2026-11-09T12:00:00.000Z',updatedAt:'2026-11-09T12:00:00.000Z'})
  queries=0
  const response=await handler(new Request('https://example.com/api/catalog/agenda?class='+encodeURIComponent('2° TECH D')),env)
  assert.equal(response.status,200);assert.equal(queries,1)
  const data=await response.json()
  assert.equal(data.activities[0].createdAt,'2026-11-09T12:00:00.000Z')
  assert.equal(data.activities[0].version,'1');assert.equal(JSON.stringify(data).includes('private@example.com'),false)
})
test('preflight caching never authorizes a different origin or touches the database',async()=>{
  queries=0
  const response=await handler(new Request('https://example.com/api/data',{method:'OPTIONS',headers:{Origin:'https://tech-2d.github.io'}}),env)
  assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Max-Age'),'600');assert.equal(queries,0)
  assert.equal((await handler(new Request('https://example.com/api/data',{method:'OPTIONS',headers:{Origin:'https://evil.example'}}),env)).status,403)
})
test('an expired session returns a non-retryable authentication code without connecting SQL',async()=>{
  const expired=createHandler({connect:async()=>{throw Error('MUST_NOT_CONNECT')},verify:async()=>{throw Object.assign(Error('UNAUTHENTICATED'),{status:401})}})
  const response=await expired(request('personalKanban/owner'),env)
  assert.equal(response.status,401);assert.equal((await response.json()).code,'unauthenticated')
})
