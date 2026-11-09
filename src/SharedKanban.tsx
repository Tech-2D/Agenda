import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { Plus, RefreshCw, Search, Settings2, Share2, Users } from 'lucide-react'
import { db } from './firebase'
import { collection, deleteDoc, doc, documentVersion, getDoc, getDocs, limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc, updateDocAtVersion, where, writeBatch } from './dataClient'
import { BoardForm, ColumnForm, EditorDialog, TaskForm } from './KanbanForms'
import { KanbanBoardView } from './KanbanBoardView'
import { copyBoardTemplate, createBoard, PRIORITIES, removeColumn, type KanbanBoard, type KanbanColumn, type KanbanTask } from './kanban'
import { kanbanInvite, memberKey, sharedKanbanLink, type KanbanMember, type KanbanRequest, type SharedBoard } from './kanbanSharing'

type Editor={kind:'new'} | {kind:'board'} | {kind:'column';column?:KanbanColumn} | {kind:'task';columnId:string;task?:KanbanTask}
export function SharedKanban({user,invite}:{user:User;invite:string | null}) {
  const [boards,setBoards]=useState<SharedBoard[]>([]),[selected,setSelected]=useState(''),[current,setCurrent]=useState<SharedBoard | null>(null)
  const [loading,setLoading]=useState(true),[opening,setOpening]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[stale,setStale]=useState(false),[refresh,setRefresh]=useState(0)
  const [editor,setEditorState]=useState<Editor | null>(null),[sharing,setSharing]=useState(false),[search,setSearch]=useState(''),[priority,setPriority]=useState('')
  const operation=useRef(false),version=useRef<string | null>(null),alive=useRef(true)
  const editLock=useRef(false),dragging=useRef(false)
  const setEditor=useCallback((value:Editor | null)=>{editLock.current=!!value;setEditorState(value)},[])
  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
  useEffect(()=>{
    let active=true;setLoading(true)
    async function load() {
      const [owned,memberships]=await Promise.all([
        getDocs(query(collection(db,'sharedKanban'),where('ownerId','==',user.uid),limit(100))),
        getDocs(query(collection(db,'kanbanMemberships'),where('userId','==',user.uid),limit(100))),
      ])
      const records=owned.docs.map(d=>d.data() as SharedBoard),ids=new Set(records.map(r=>r.board.id))
      const joined=await Promise.all(memberships.docs.filter(d=>!ids.has(d.data().boardId)).map(async grant=>{
        try {const row=await getDoc(doc(db,'sharedKanban',grant.data().boardId));return row.exists() ? row.data() as SharedBoard : null}
        catch(e){if((e as {code?:string}).code==='permission-denied')return null;throw e}
      }))
      if(active){setBoards([...records,...joined.filter((r):r is SharedBoard=>!!r)]);setNotice('')}
    }
    void load().catch(()=>{if(active)setError('Não foi possível carregar os quadros compartilhados. Tente atualizar.')}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[user.uid,refresh])
  useEffect(()=>{
    if(!selected){setCurrent(null);return}
    let active=true,unsubscribe:()=>void=()=>{}
    setOpening(true);setCurrent(null);setError('');setStale(false);setEditor(null);version.current=null;dragging.current=false
    const ref=doc(db,'sharedKanban',selected)
    void getDoc(ref).then(snapshot=>{
      if(!active)return
      if(!snapshot.exists())throw Error('MISSING_BOARD')
      version.current=documentVersion(ref);setCurrent(snapshot.data() as SharedBoard)
      unsubscribe=onSnapshot(ref,latest=>{
        if(!active || operation.current)return
        if(!latest.exists()){setCurrent(null);setBoards(bs=>bs.filter(b=>b.board.id!==selected));setError('Este quadro foi excluído.');return}
        if(documentVersion(ref)!==version.current){
          if(editLock.current || dragging.current){setStale(true);setNotice('Outra pessoa atualizou este quadro. Atualize para continuar sem sobrescrever as alterações dela.')}
          else{const next=latest.data() as SharedBoard;version.current=documentVersion(ref);setCurrent(next);setBoards(bs=>bs.map(b=>b.board.id===selected ? next : b));setStale(false);setError('');setNotice('Quadro atualizado com as alterações do grupo.')}
        }
      },()=>{if(active){setCurrent(null);setEditor(null);setBoards(bs=>bs.filter(b=>b.board.id!==selected));setError('Não foi possível confirmar seu acesso. O dono pode ter removido sua participação. Atualize para conferir.')}})
    }).catch(()=>{if(active)setError('Este quadro não está disponível ou você ainda não tem acesso.')}).finally(()=>{if(active)setOpening(false)})
    return()=>{active=false;unsubscribe()}
  },[selected,user.uid,refresh,setEditor])
  const board=current?.board,owner=current?.ownerId===user.uid,disabled=busy || opening || stale
  function reload(){if(editor && !window.confirm('Descartar o formulário não salvo e atualizar o quadro?'))return;setEditor(null);setRefresh(n=>n+1)}
  async function saveBoard(next:KanbanBoard) {
    if(!current || operation.current || !version.current || stale)return false
    operation.current=true;setBusy(true);setError('');setNotice('')
    try {
      const ref=doc(db,'sharedKanban',current.board.id)
      await updateDocAtVersion(ref,{board:next,updatedAt:serverTimestamp()},version.current)
      const snapshot=await getDoc(ref)
      if(!alive.current)return false
      version.current=documentVersion(ref);const saved=snapshot.data() as SharedBoard
      setCurrent(saved);setBoards(bs=>bs.map(b=>b.board.id===saved.board.id ? saved : b));setNotice('Quadro compartilhado salvo.');return true
    } catch(e){if(alive.current){setStale(true);setError((e as {code?:string}).code==='aborted' ? 'Outra pessoa editou este quadro. Atualize antes de salvar novamente.' : 'Não foi possível confirmar o salvamento ou seu acesso. Atualize antes de continuar.')}return false}
    finally{operation.current=false;if(alive.current)setBusy(false)}
  }
  async function create(board:KanbanBoard) {
    if(operation.current)return
    operation.current=true;setBusy(true);setError('')
    try {
      const ref=doc(collection(db,'sharedKanban')),record={ownerId:user.uid,board:{...board,id:ref.id},createdAt:serverTimestamp(),updatedAt:serverTimestamp()}
      await setDoc(ref,record)
      if(alive.current){setEditor(null);setSelected(ref.id);setRefresh(n=>n+1)}
    } catch{if(alive.current)setError('Não foi possível criar o quadro. Confira sua conexão e tente novamente.')}
    finally{operation.current=false;if(alive.current)setBusy(false)}
  }
  async function remove() {
    if(!current || !owner || !window.confirm(`Excluir “${current.board.name}” para todos os participantes? As tarefas serão removidas do quadro.`))return
    setBusy(true)
    try{await deleteDoc(doc(db,'sharedKanban',current.board.id));setCurrent(null);setSelected('');setEditor(null);setRefresh(n=>n+1)}catch{setError('Não foi possível excluir o quadro. Atualize e tente novamente.')}finally{setBusy(false)}
  }
  async function leave() {
    if(!current || owner || !window.confirm('Sair deste quadro compartilhado? O dono precisará aprovar seu acesso novamente.'))return
    setBusy(true)
    try{const key=memberKey(current.board.id,user.uid),batch=writeBatch(db);batch.delete(doc(db,'kanbanMemberships',key));batch.update(doc(db,'kanbanRequests',key),{status:'revoked',updatedAt:serverTimestamp()});await batch.commit();setCurrent(null);setSelected('');setRefresh(n=>n+1)}catch{setError('Não foi possível sair do quadro. Tente novamente.')}finally{setBusy(false)}
  }
  return <>
    <JoinSharedBoard key={invite || 'manual'} initialInvite={invite} user={user} onApproved={id=>{setSelected(id);setRefresh(n=>n+1)}}/>
    <div className="kb-feedback" aria-live="polite">{busy ? 'Salvando…' : notice}{error && <span className="kb-error" role="alert">{error}</span>}{(stale || error) && <button className="kb-link" disabled={busy} onClick={reload}>Atualizar quadros</button>}</div>
    <div className="kb-layout"><aside className="kb-boards"><h2>Compartilhados <Users size={15}/></h2><button className="kb-link" disabled={busy || loading} onClick={reload}><RefreshCw size={14}/> Atualizar</button><nav>{boards.map(b=><button key={b.board.id} className={selected===b.board.id ? 'active' : ''} onClick={()=>{setSelected(b.board.id);setSearch('');setPriority('')}}><i className={`kb-dot kb-color-${b.board.color}`}/><span>{b.board.name}<small className="kb-board-role">{b.ownerId===user.uid ? 'Você é o dono' : 'Participante'}</small></span></button>)}</nav><button className="kb-add" disabled={busy} onClick={()=>{setError('');setEditor({kind:'new'})}}><Plus size={16}/> Novo compartilhado</button><p className="kb-private-note">Só o dono e as pessoas aprovadas veem e editam estes quadros. Ter o link não libera acesso automaticamente.</p></aside>
    <section className="kb-workarea">{opening || loading ? <p className="kb-state" role="status">Carregando quadros…</p> : !board ? <div className="kb-empty"><Users size={36}/><h2>Organizem as tarefas juntos</h2><p>Crie um quadro para seu grupo ou abra um link de convite e peça acesso ao dono.</p><button className="primary-button" disabled={busy} onClick={()=>setEditor({kind:'new'})}>Criar quadro compartilhado</button></div> : <>
      <header className="kb-board-heading"><div><span className={`kb-dot kb-color-${board.color}`}/><h2>{board.name}</h2><small>Compartilhado · {owner ? 'você é o dono' : 'você pode editar'}</small></div><div>{owner && <button className="secondary-button" disabled={disabled} onClick={()=>setSharing(true)}><Share2 size={16}/> Compartilhar e acessos</button>}<button className="secondary-button" disabled={disabled} onClick={()=>{setError('');setEditor({kind:'board'})}}><Settings2 size={16}/> Personalizar</button>{!owner && <button className="kb-link" disabled={busy} onClick={()=>void leave()}>Sair do quadro</button>}</div></header>
      <div className="kb-toolbar"><label className="kb-search"><Search size={17}/><input aria-label="Buscar tarefas compartilhadas" placeholder="Buscar tarefa ou etiqueta" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Filtrar prioridade compartilhada" value={priority} onChange={e=>setPriority(e.target.value)}><option value="">Todas as prioridades</option>{Object.entries(PRIORITIES).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select><button className="kb-add" disabled={disabled || board.columns.length>=12} onClick={()=>setEditor({kind:'column'})}><Plus size={16}/> Coluna</button></div>
      <p className="kb-hint">Todos os participantes podem organizar tarefas. As mudanças são conferidas por versão; se outra pessoa editar, atualize antes de continuar.</p>
      <KanbanBoardView key={board.id} board={board} disabled={disabled} search={search} priority={priority} canAddTask={board.tasks.length<200} onChange={saveBoard} onInteractionChange={active=>{dragging.current=active}} onEditTask={task=>{setError('');setEditor({kind:'task',columnId:task.columnId,task})}} onEditColumn={column=>{setError('');setEditor({kind:'column',column})}} onAddTask={columnId=>{setError('');setEditor({kind:'task',columnId})}}/>
    </>}</section></div>
    {sharing && current && owner && <SharedAccessDialog user={user} record={current} onClose={()=>setSharing(false)}/>}
    {editor && <EditorDialog title={editor.kind==='new' ? 'Novo quadro compartilhado' : editor.kind==='board' ? 'Personalizar quadro compartilhado' : editor.kind==='column' ? 'Configurar coluna' : 'Tarefa compartilhada'} busy={busy} error={error} stale={stale} onReload={reload} onClose={()=>{setEditor(null);setError('')}}>
      {editor.kind==='new' ? <><p>Você será o dono. Depois de criar, use “Compartilhar e acessos” para convidar e aprovar participantes.</p><BoardForm disabled={busy} onDelete={()=>{}} onSave={async(name,color,compact,template)=>{await create({...createBoard(name,template,color),compact})}}/></> : editor.kind==='board' && board ? <BoardForm board={board} disabled={disabled} canDelete={owner} onDelete={()=>void remove()} onDuplicate={async()=>{await create(copyBoardTemplate(board))}} onSave={async(name,color,compact)=>{if(await saveBoard({...board,name,color,compact}))setEditor(null)}}/> : editor.kind==='column' && board ? <ColumnForm column={editor.column} disabled={disabled} onDelete={async()=>{try{const next=removeColumn(board,editor.column!.id);if(window.confirm('Excluir esta coluna vazia?') && await saveBoard(next))setEditor(null)}catch(e){setError((e as Error).message)}}} onSave={async column=>{if(await saveBoard({...board,columns:editor.column ? board.columns.map(c=>c.id===column.id ? column : c) : [...board.columns,column]}))setEditor(null)}}/> : editor.kind==='task' && board ? <TaskForm task={editor.task} columnId={editor.columnId} columns={board.columns} disabled={disabled} onDelete={async()=>{if(window.confirm('Excluir esta tarefa para todos?') && await saveBoard({...board,tasks:board.tasks.filter(t=>t.id!==editor.task!.id)}))setEditor(null)}} onSave={async task=>{if(await saveBoard({...board,tasks:editor.task ? board.tasks.map(t=>t.id===task.id ? task : t) : [...board.tasks,task]}))setEditor(null)}}/> : null}
    </EditorDialog>}
  </>
}

function JoinSharedBoard({initialInvite,user,onApproved}:{initialInvite:string | null;user:User;onApproved:(id:string)=>void}) {
  const [value,setValue]=useState(initialInvite || ''),[boardId,setBoardId]=useState(initialInvite || ''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const approved=useRef(''),callback=useRef(onApproved)
  useEffect(()=>{callback.current=onApproved},[onApproved])
  useEffect(()=>{
    if(!boardId)return
    setStatus('checking');setError('')
    return onSnapshot(doc(db,'kanbanRequests',memberKey(boardId,user.uid)),snapshot=>{
      const state=snapshot.exists() ? snapshot.data().status as string : ''
      setStatus(state)
      if(state!=='approved')approved.current=''
      if(state==='approved' && approved.current!==boardId){approved.current=boardId;callback.current(boardId)}
    },()=>{setError('Não foi possível conferir o convite. Confira o link ou tente novamente.');setStatus('')})
  },[boardId,user.uid])
  async function request() {
    if(!boardId || !user.email)return
    setBusy(true);setError('')
    try{
      const ref=doc(db,'kanbanRequests',memberKey(boardId,user.uid)),existing=await getDoc(ref)
      if(existing.exists())await updateDoc(ref,{status:'pending',updatedAt:serverTimestamp()})
      else await setDoc(ref,{boardId,userId:user.uid,userEmail:user.email,name:(user.displayName || user.email).slice(0,80),status:'pending',createdAt:serverTimestamp(),updatedAt:serverTimestamp()})
      setStatus('pending')
    }catch{setError('Não foi possível pedir acesso. Confira o convite. Se você já participa ou é o dono, abra o quadro na lista.')}
    finally{setBusy(false)}
  }
  return <section className="kb-join"><div><strong>Recebeu um convite?</strong><small>Cole o link. O dono precisa aprovar sua conta antes de você ver as tarefas.</small></div><form onSubmit={e=>{e.preventDefault();let id=kanbanInvite(value);try{id=id || kanbanInvite(new URL(value).hash)}catch{/* A bare board ID is also accepted. */}if(!id && /^[A-Za-z0-9_-]{1,80}$/.test(value.trim()))id=value.trim();if(id){setBoardId(id);setError('')}else setError('Cole um link válido de convite do Kanban.')}}><input aria-label="Link de convite do Kanban" placeholder="Cole o link do quadro" value={value} onChange={e=>setValue(e.target.value)}/><button className="secondary-button" disabled={busy}>Conferir convite</button></form>{boardId && <div className="kb-join-status">{status==='pending' ? <p role="status">Pedido enviado. Aguarde o dono aprovar sua conta.</p> : status==='approved' ? <><p role="status">Sua solicitação foi aprovada. Se você saiu do quadro, pode pedir acesso novamente.</p><button className="kb-link" disabled={busy} onClick={()=>void request()}>Pedir acesso novamente</button></> : <><p>{status==='checking' ? 'Conferindo pedido…' : status==='rejected' ? 'O pedido foi recusado. Você pode solicitar novamente.' : status==='revoked' ? 'Seu acesso foi removido. Peça novamente se precisar.' : 'Solicite acesso com sua conta da Agenda.'}</p><button className="primary-button" disabled={busy || status==='checking'} onClick={()=>void request()}>{busy ? 'Enviando…' : 'Pedir acesso ao quadro'}</button></>}</div>}{error && <p className="kb-error" role="alert">{error}</p>}</section>
}

function SharedAccessDialog({user,record,onClose}:{user:User;record:SharedBoard;onClose:()=>void}) {
  const [requests,setRequests]=useState<KanbanRequest[]>([]),[members,setMembers]=useState<KanbanMember[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const boardId=record.board.id,link=sharedKanbanLink(window.location.href,boardId)
  useEffect(()=>{
    const first=onSnapshot(query(collection(db,'kanbanRequests'),where('boardId','==',boardId),limit(100)),snapshot=>setRequests(snapshot.docs.map(d=>({...d.data(),id:d.id}) as KanbanRequest)),()=>setError('Não foi possível atualizar os pedidos.'))
    const second=onSnapshot(query(collection(db,'kanbanMemberships'),where('boardId','==',boardId),limit(100)),snapshot=>setMembers(snapshot.docs.map(d=>({...d.data(),id:d.id}) as KanbanMember)),()=>setError('Não foi possível atualizar os participantes.'))
    return()=>{first();second()}
  },[boardId])
  async function review(request:KanbanRequest,approve:boolean) {
    setBusy(true);setError('');setNotice('')
    try{
      const batch=writeBatch(db)
      if(approve)batch.set(doc(db,'kanbanMemberships',memberKey(boardId,request.userId)),{boardId,userId:request.userId,userEmail:request.userEmail,name:request.name,createdAt:serverTimestamp()})
      batch.update(doc(db,'kanbanRequests',request.id),{status:approve ? 'approved' : 'rejected',updatedAt:serverTimestamp()})
      await batch.commit();setNotice(approve ? 'Participante aprovado. Já pode ver e editar o quadro.' : 'Pedido recusado.')
    }catch{setError('Não foi possível alterar o acesso. Atualize os pedidos e tente novamente.')}
    finally{setBusy(false)}
  }
  async function revoke(member:KanbanMember) {
    if(!window.confirm(`Remover o acesso de ${member.name}?`))return
    setBusy(true);setError('')
    try{const batch=writeBatch(db);batch.delete(doc(db,'kanbanMemberships',member.id));batch.update(doc(db,'kanbanRequests',memberKey(boardId,member.userId)),{status:'revoked',updatedAt:serverTimestamp()});await batch.commit();setNotice('Acesso removido.')}
    catch{setError('Não foi possível remover o acesso. Tente novamente.')}
    finally{setBusy(false)}
  }
  return <EditorDialog title="Compartilhar e gerenciar acessos" busy={busy} error={error} stale={false} onReload={()=>{}} onClose={onClose}><div className="kb-access"><p>Envie o link para o grupo. Cada pessoa entra na própria conta e pede acesso. Confira quem é a pessoa antes de aprovar; todos os aprovados podem editar as tarefas.</p><label>Link de convite<input readOnly value={link} onFocus={e=>e.target.select()}/></label><button className="secondary-button" disabled={busy} onClick={()=>void navigator.clipboard.writeText(link).then(()=>setNotice('Link copiado.')).catch(()=>setNotice('Selecione o link acima e copie manualmente.'))}>Copiar link</button>{notice && <p role="status">{notice}</p>}<h3>Pedidos de acesso</h3>{requests.filter(r=>r.status==='pending').length===0 && <p>Nenhum pedido pendente.</p>}{requests.filter(r=>r.status==='pending').map(r=><div className="kb-person" key={r.id}><div><strong>{r.name}</strong><small>{r.userEmail}</small></div><button className="primary-button" disabled={busy} onClick={()=>void review(r,true)}>Aprovar</button><button className="secondary-button" disabled={busy} onClick={()=>void review(r,false)}>Recusar</button></div>)}<h3>Quem participa</h3><p>Você ({user.email}) · dono</p>{members.map(m=><div className="kb-person" key={m.id}><div><strong>{m.name}</strong><small>{m.userEmail}</small></div><button className="kb-delete" disabled={busy} onClick={()=>void revoke(m)}>Remover acesso</button></div>)}</div></EditorDialog>
}
