// Defaults to read-only. --execute creates/edits/removes one temporary private shared board.
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {initializeApp,cert} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {reportFailure} from './connection.js'
const base='https://tech-2d-agenda-sql.tech-2d-auth-email.workers.dev/api/data'
let token,temporaryPath,attempted=false
const report={}
async function call(body,{authenticated=true,status=200}={}) {
  const response=await fetch(base,{method:'POST',headers:{Origin:'https://tech-2d.github.io','Content-Type':'application/json',...(authenticated ? {Authorization:'Bearer '+token} : {})},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(30000)})
  if(response.status!==status)throw Error('SHARED_SMOKE_HTTP_'+response.status)
  return response.json()
}
const commit=writes=>call({action:'commit',commit:{id:randomUUID(),writes}})
try {
  const email=process.env.TEST_ADMIN_EMAIL
  if(!email || !email.includes('@'))throw Error('TEST_ADMIN_EMAIL_REQUIRED')
  const key=JSON.parse(await readFile('../firebase-credentials/2d-tech-novo.json','utf8'))
  if(key.project_id!=='d-tech-8555e')throw Error('WRONG_FIREBASE_PROJECT')
  const auth=getAuth(initializeApp({credential:cert(key)})),user=await auth.getUserByEmail(email)
  if(user.disabled)throw Error('ACCOUNT_DISABLED')
  const login=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyCscvBCfXJJhOd1B0ySY1g2hbwjNkWUdvo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:await auth.createCustomToken(user.uid),returnSecureToken:true}),redirect:'error',signal:AbortSignal.timeout(15000)})
  if(!login.ok)throw Error('AUTHENTICATION_CHECK_FAILED')
  token=(await login.json()).idToken
  for(const [path,field] of [['sharedKanban','ownerId'],['kanbanMemberships','userId'],['kanbanRequests','userId']]) {
    const result=await call({action:'query',query:{path,filters:[{field,op:'==',value:user.uid}],limit:100}})
    if(!Array.isArray(result.documents))throw Error('SHARED_QUERY_FAILED')
  }
  report.sqlOwnQueries=true
  await call({action:'query',query:{path:'sharedKanban',limit:100}},{status:403});report.unscopedListingBlocked=true
  if(process.argv.includes('--execute')) {
    const id='verify_'+randomUUID(),stamp={__tech2dType:'serverTimestamp'}
    temporaryPath='sharedKanban/'+id
    const board={id,name:'[Teste técnico temporário do Kanban]',color:'blue',compact:false,columns:[{id:'todo',name:'Teste',color:'blue',done:false}],tasks:[]}
    attempted=true
    await commit([{op:'create',path:temporaryPath,data:{ownerId:user.uid,board,createdAt:stamp,updatedAt:stamp}}]);report.created=true
    const first=(await call({action:'get',path:temporaryPath})).document
    const edited={...board,tasks:[{id:'task',columnId:'todo',title:'Teste temporário',description:'Removido ao concluir a verificação.',priority:'none',dueDate:null,labels:[],checklist:[]}]}
    await commit([{op:'update',path:temporaryPath,version:first.version,data:{board:edited,updatedAt:stamp}}])
    if((await call({action:'get',path:temporaryPath})).document?.data?.board?.tasks?.length!==1)throw Error('SHARED_EDIT_FAILED')
    report.edited=true
    await call({action:'commit',commit:{id:randomUUID(),writes:[{op:'update',path:temporaryPath,version:first.version,data:{board,updatedAt:stamp}}]}},{status:409});report.staleEditBlocked=true
    await call({action:'get',path:temporaryPath},{authenticated:false,status:403});report.anonymousReadBlocked=true
    await commit([{op:'delete',path:temporaryPath}]);attempted=false
    await call({action:'get',path:temporaryPath},{status:403});report.testBoardRemoved=true
  }
  console.log(JSON.stringify({...report,existingBoardsChanged:false,passwordsChanged:false,applicationWrites:report.created ? 3 : 0}))
} catch(error){reportFailure(error)}
finally {
  if(attempted && temporaryPath && token) {
    try{await commit([{op:'delete',path:temporaryPath}]);console.log(JSON.stringify({temporaryBoardCleanup:true}))}
    catch{console.error('TEMPORARY_BOARD_CLEANUP_NOT_CONFIRMED');process.exitCode=1}
  }
  token=null
}
