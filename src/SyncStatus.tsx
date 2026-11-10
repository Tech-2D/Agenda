import {useEffect,useRef,useState} from 'react'
import {onAuthStateChanged} from 'firebase/auth'
import {CloudUpload,TriangleAlert} from 'lucide-react'
import {auth} from './firebase'
import {queuedWrites,resetQueuedSession} from './queuedWrites'
import type {QueueView} from './writeQueue'

export function SyncStatus() {
  const [items,setItems]=useState<QueueView[]>([]),[notice,setNotice]=useState('')
  const actor=useRef(auth.currentUser)
  useEffect(()=>{
    const publish=()=>setItems(queuedWrites.pending())
    const stop=queuedWrites.subscribe(publish);publish()
    const account=onAuthStateChanged(auth,user=>{if(user?.uid!==actor.current?.uid){actor.current=user;resetQueuedSession();setNotice('')}})
    const before=(event:BeforeUnloadEvent)=>{if(queuedWrites.pending().length){event.preventDefault();event.returnValue=''}}
    const online=()=>{for(const item of queuedWrites.pending())if(item.failed?.retryable)queuedWrites.retry(item.key)}
    window.addEventListener('beforeunload',before);window.addEventListener('online',online)
    return()=>{stop();account();window.removeEventListener('beforeunload',before);window.removeEventListener('online',online)}
  },[])
  if(!items.length)return null
  const failed=items.filter(i=>i.failed),count=items.reduce((n,i)=>n+i.pending,0)
  async function copy() {
    try{await navigator.clipboard.writeText(JSON.stringify(items.map(i=>({tipo:i.kind,caminho:i.path,rascunho:i.value.data})),null,2));setNotice('Rascunho copiado. Guarde em um local privado antes de recarregar.')}
    catch{setNotice('Não foi possível copiar. Mantenha a página aberta para não perder o rascunho.')}
  }
  function reload() {
    if(items.some(i=>i.sending)){setNotice('Espere a tentativa atual terminar antes de recarregar.');return}
    if(!window.confirm('Descartar os rascunhos ainda não confirmados e carregar os dados do servidor? Copie seu rascunho primeiro se precisar guardá-lo.'))return
    for(const item of items)queuedWrites.discard(item.key)
    window.location.reload()
  }
  return <aside className={`sync-status${failed.length ? ' sync-status-failed' : ''}`} aria-label="Salvamento em segundo plano">
    <div role="status" aria-live="polite">{failed.length ? <TriangleAlert size={18}/> : <CloudUpload size={18}/>}<span><strong>{failed.length ? 'Há alterações não confirmadas' : `${count} ${count===1 ? 'envio pendente' : 'envios pendentes'}`}</strong><small>{failed.length ? failed[0].failed!.message : 'Você pode continuar usando a Agenda. Mantenha esta página aberta até terminar.'}</small></span></div>
    <details><summary>Ver fila de salvamento</summary><ul>{items.map(item=><li key={item.key}><span>{item.label}</span><small>{item.failed ? 'Revisão necessária' : item.sending ? 'Enviando…' : 'Na fila'}</small>{item.failed?.retryable && <button className="kb-link" onClick={()=>queuedWrites.retry(item.key)}>Tentar novamente</button>}</li>)}</ul><div className="sync-actions"><button onClick={()=>void copy()}>Copiar rascunhos</button><button onClick={reload}>Descartar e recarregar</button></div>{notice && <p role="status">{notice}</p>}</details>
  </aside>
}
