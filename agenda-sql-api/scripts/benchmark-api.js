// A small read-only latency sample. No record contents or account identifiers are printed.
import {readFile} from 'node:fs/promises'
import {initializeApp,cert} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {reportFailure} from './connection.js'
const base='https://tech-2d-agenda-sql.tech-2d-auth-email.workers.dev'
try {
  const targets=[{name:'public-agenda',url:base+'/api/catalog/agenda?class='+encodeURIComponent('2° TECH D')}]
  if(process.env.TEST_ADMIN_EMAIL) {
    const key=JSON.parse(await readFile('../firebase-credentials/2d-tech-novo.json','utf8'))
    if(key.project_id!=='d-tech-8555e')throw Error('WRONG_FIREBASE_PROJECT')
    const auth=getAuth(initializeApp({credential:cert(key)})),user=await auth.getUserByEmail(process.env.TEST_ADMIN_EMAIL)
    if(user.disabled)throw Error('ACCOUNT_DISABLED')
    const login=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyCscvBCfXJJhOd1B0ySY1g2hbwjNkWUdvo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:await auth.createCustomToken(user.uid),returnSecureToken:true}),redirect:'error',signal:AbortSignal.timeout(15000)})
    if(!login.ok)throw Error('AUTHENTICATION_FAILED')
    const token=(await login.json()).idToken
    targets.push({name:'authenticated-own-document',url:base+'/api/data',body:{action:'get',path:'personalKanban/'+user.uid},token})
  }
  const report={applicationWrites:0,samples:5,results:[]}
  for(const target of targets) {
    const samples=[]
    for(let i=0;i<5;i++) {
      const start=performance.now(),response=await fetch(target.url,{method:target.body ? 'POST' : 'GET',headers:{Origin:'https://tech-2d.github.io',...(target.body ? {'Content-Type':'application/json',Authorization:'Bearer '+target.token} : {})},...(target.body ? {body:JSON.stringify(target.body)} : {}),redirect:'error',signal:AbortSignal.timeout(30000)})
      await response.arrayBuffer()
      if(!response.ok)throw Error('BENCHMARK_HTTP_'+response.status)
      samples.push(Math.round(performance.now()-start))
    }
    const sorted=[...samples].sort((a,b)=>a-b)
    report.results.push({name:target.name,samplesMs:samples,p50Ms:sorted[2],p95Ms:sorted[4]})
  }
  console.log(JSON.stringify(report))
}catch(error){reportFailure(error)}
