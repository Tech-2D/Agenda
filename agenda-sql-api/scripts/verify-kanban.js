// Read-only production smoke: no workspace creation or task changes.
import {readFile} from 'node:fs/promises'
import {initializeApp,cert} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {reportFailure} from './connection.js'

try {
  const email=process.env.TEST_ADMIN_EMAIL
  if(!email || !email.includes('@'))throw Error('TEST_ADMIN_EMAIL_REQUIRED')
  const key=JSON.parse(await readFile('../firebase-credentials/2d-tech-novo.json','utf8'))
  if(key.project_id!=='d-tech-8555e')throw Error('WRONG_FIREBASE_PROJECT')
  const auth=getAuth(initializeApp({credential:cert(key)})),account=await auth.getUserByEmail(email)
  if(account.disabled)throw Error('ACCOUNT_DISABLED')
  const login=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyCscvBCfXJJhOd1B0ySY1g2hbwjNkWUdvo',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:await auth.createCustomToken(account.uid),returnSecureToken:true}),signal:AbortSignal.timeout(15000),redirect:'error',
  })
  if(!login.ok)throw Error('AUTHENTICATION_CHECK_FAILED')
  const session=await login.json()
  const call=async(body,authenticated=true)=>fetch('https://tech-2d-agenda-sql.tech-2d-auth-email.workers.dev/api/data',{
    method:'POST',headers:{Origin:'https://tech-2d.github.io','Content-Type':'application/json',...(authenticated ? {Authorization:'Bearer '+session.idToken} : {})},
    body:JSON.stringify(body),signal:AbortSignal.timeout(30000),redirect:'error',
  })
  const own=await call({action:'get',path:'personalKanban/'+account.uid})
  if(own.status!==200)throw Error('KANBAN_OWN_READ_FAILED')
  const result=await own.json()
  if(result.document && result.document.data?.ownerId!==account.uid)throw Error('KANBAN_OWNER_MISMATCH')
  if((await call({action:'get',path:'personalKanban/'+account.uid},false)).status!==403)throw Error('KANBAN_ANONYMOUS_READ_NOT_BLOCKED')
  if((await call({action:'get',path:'personalKanban/kanban-non-owner-check'})).status!==403)throw Error('KANBAN_CROSS_ACCOUNT_READ_NOT_BLOCKED')
  if((await call({action:'query',query:{path:'personalKanban'}})).status!==403)throw Error('KANBAN_LISTING_NOT_BLOCKED')
  session.idToken=null;session.refreshToken=null
  console.log(JSON.stringify({sqlOwnWorkspaceRead:true,anonymousReadBlocked:true,crossAccountReadBlocked:true,collectionListingBlocked:true,applicationWrites:0,passwordsChanged:false}))
} catch(error) {reportFailure(error)}
