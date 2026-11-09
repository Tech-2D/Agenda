import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {context,commitDocuments,queryDocuments,readDocument,putDocument} from '../src/document-store.js'

const engine=new PGlite()
for(const file of ['001_initial','002_application'])await engine.exec(await readFile(new URL('../migrations/'+file+'.sql',import.meta.url),'utf8'))
const db={query:(sql,params)=>engine.query(sql,params)}
after(()=>engine.close())
const owner={user:{uid:'owner',email:'owner@example.com'}},member={user:{uid:'member',email:'member@example.com'}},stranger={user:{uid:'stranger',email:'stranger@example.com'}},admin={user:{uid:'superadmin',email:'admin@example.com'}}
await putDocument(db,'admins/superadmin',{role:'superadmin'})
const stamp={__tech2dType:'serverTimestamp'},path='sharedKanban/shared-board',requestPath='kanbanRequests/shared-board_member',grantPath='kanbanMemberships/shared-board_member'
const board={id:'shared-board',name:'Grupo de estudos',color:'pink',compact:false,columns:[{id:'todo',name:'A fazer',color:'blue',done:false}],tasks:[]}
const commit=(identity,writes)=>commitDocuments(db,identity,{id:crypto.randomUUID(),writes})
const query=(identity,path,filters=[])=>context(db,identity).then(c=>queryDocuments(db,c,{path,filters,limit:100}))
const read=(identity,path)=>context(db,identity).then(c=>readDocument(db,c,path))

test('authenticated owner creates a shared board with no implicit admin or anonymous access',async()=>{
  await commit(owner,[{op:'set',path,data:{ownerId:'owner',board,createdAt:stamp,updatedAt:stamp}}])
  assert.equal((await read(owner,path)).data.board.name,'Grupo de estudos')
  for(const identity of [{},stranger,member,admin,{service:'web'}])await assert.rejects(()=>read(identity,path),{status:403})
  assert.equal((await query(owner,'sharedKanban',[{field:'ownerId',op:'==',value:'owner'}])).length,1)
  for(const identity of [owner,stranger,admin,{}])await assert.rejects(()=>query(identity,'sharedKanban'),{status:403})
  await assert.rejects(()=>query(stranger,'sharedKanban',[{field:'ownerId',op:'==',value:'owner'}]),{status:403})
})
test('a link only allows a signed-in person to request access, never read the board',async()=>{
  const data={boardId:'shared-board',userId:'member',userEmail:'member@example.com',name:'Colega',status:'pending',createdAt:stamp,updatedAt:stamp}
  assert.equal(await read(member,requestPath),null)
  await assert.rejects(()=>commit({},[{op:'set',path:requestPath,data}]),{status:403})
  await assert.rejects(()=>commit(stranger,[{op:'set',path:requestPath,data}]),{status:403})
  await assert.rejects(()=>commit(member,[{op:'set',path:requestPath,data:{...data,userEmail:'forged@example.com'}}]),{status:403})
  await assert.rejects(()=>commit(member,[{op:'set',path:requestPath,data:{...data,status:'approved'}}]),{status:403})
  await commit(member,[{op:'set',path:requestPath,data}])
  assert.equal((await read(owner,requestPath)).data.status,'pending')
  await assert.rejects(()=>read(member,path),{status:403})
  await assert.rejects(()=>read(stranger,requestPath),{status:403})
})
test('only the owner approves; a forged self-grant and forged approval batch are atomic failures',async()=>{
  const grant={boardId:'shared-board',userId:'member',userEmail:'member@example.com',name:'Colega',createdAt:stamp}
  const writes=[{op:'set',path:grantPath,data:grant},{op:'update',path:requestPath,data:{status:'approved',updatedAt:stamp}}]
  for(const identity of [member,stranger,admin])await assert.rejects(()=>commit(identity,writes),{status:403})
  assert.equal(await read(member,grantPath),null)
  assert.equal((await read(owner,requestPath)).data.status,'pending')
  await commit(owner,writes)
  assert.equal((await read(member,path)).data.ownerId,'owner')
})
test('members edit tasks and custom columns, but cannot transfer ownership or change ACL data',async()=>{
  const original=await read(member,path)
  const changed=structuredClone(board);changed.tasks.push({id:'task',columnId:'todo',title:'Revisar prova',description:'Em grupo',priority:'medium',dueDate:null,labels:['Estudos'],checklist:[]})
  await commit(member,[{op:'update',path,version:original.version,data:{board:changed,updatedAt:stamp}}])
  assert.equal((await read(owner,path)).data.board.tasks[0].title,'Revisar prova')
  await assert.rejects(()=>commit(owner,[{op:'update',path,version:original.version,data:{board,updatedAt:stamp}}]),{status:409})
  for(const data of [{ownerId:'member'},{memberIds:['stranger']},{createdAt:'2000-01-01T00:00:00Z'}])await assert.rejects(()=>commit(member,[{op:'update',path,data:{...data,updatedAt:stamp}}]),{status:403})
  await assert.rejects(()=>commit(member,[{op:'delete',path}]),{status:403})
  await assert.rejects(()=>commit(admin,[{op:'delete',path}]),{status:403})
})
test('membership and request lists require an owner or an exact own-user query',async()=>{
  assert.equal((await query(member,'kanbanMemberships',[{field:'userId',op:'==',value:'member'}])).length,1)
  assert.equal((await query(owner,'kanbanMemberships',[{field:'boardId',op:'==',value:'shared-board'}])).length,1)
  assert.equal((await query(owner,'kanbanRequests',[{field:'boardId',op:'==',value:'shared-board'}])).length,1)
  for(const identity of [member,stranger,admin,{}]) {
    await assert.rejects(()=>query(identity,'kanbanMemberships',[{field:'boardId',op:'==',value:'shared-board'}]),{status:403})
    await assert.rejects(()=>query(identity,'kanbanRequests',[{field:'boardId',op:'==',value:'shared-board'}]),{status:403})
  }
})
test('revoking access immediately blocks reads and writes; the link is never a backdoor',async()=>{
  await commit(owner,[{op:'delete',path:grantPath},{op:'update',path:requestPath,data:{status:'revoked',updatedAt:stamp}}])
  await assert.rejects(()=>read(member,path),{status:403})
  await assert.rejects(()=>commit(member,[{op:'update',path,data:{board,updatedAt:stamp}}]),{status:403})
  await commit(member,[{op:'update',path:requestPath,data:{status:'pending',updatedAt:stamp}}])
  await assert.rejects(()=>read(member,path),{status:403})
})
test('a participant can leave atomically and must request approval again',async()=>{
  await commit(owner,[{op:'set',path:grantPath,data:{boardId:'shared-board',userId:'member',userEmail:'member@example.com',name:'Colega',createdAt:stamp}},{op:'update',path:requestPath,data:{status:'approved',updatedAt:stamp}}])
  await commit(member,[{op:'delete',path:grantPath},{op:'update',path:requestPath,data:{status:'revoked',updatedAt:stamp}}])
  await assert.rejects(()=>read(member,path),{status:403})
  assert.equal((await read(member,requestPath)).data.status,'revoked')
  await commit(member,[{op:'update',path:requestPath,data:{status:'pending',updatedAt:stamp}}])
})
test('deleting a board leaves no readable board content through an old membership or link',async()=>{
  await commit(owner,[{op:'delete',path}])
  await assert.rejects(()=>read(member,path),{status:403})
  await assert.rejects(()=>read(owner,path),{status:403})
})
