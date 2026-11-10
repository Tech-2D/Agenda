import { useEffect, useRef, useState, type FormEvent } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, type User } from 'firebase/auth'
import { signOut } from './sessionActions'
import { ChevronLeft, LayoutPanelLeft, LockKeyhole, LogOut, Plus, Search, Settings2, Users } from 'lucide-react'
import { auth, db } from './firebase'
import { doc, getDoc } from './dataClient'
import { enqueueDocument, queuedDocument, queuedViewData, seedQueuedDocument, subscribeQueuedDocument } from './queuedWrites'
import { requestPasswordReset } from './passwordReset'
import { copyBoardTemplate, createBoard, PRIORITIES, removeColumn, replaceBoard, workspaceLimit, type KanbanBoard, type KanbanColumn, type KanbanTask } from './kanban'
import { BoardForm, ColumnForm, TaskForm, EditorDialog } from './KanbanForms'
import { KanbanBoardView } from './KanbanBoardView'
import { SharedKanban } from './SharedKanban'
import { kanbanInvite } from './kanbanSharing'
import './kanban.css'

export default function KanbanPage({ onBack }: { onBack: () => void }) {
  const [user, setUser] = useState<User | null>(null)
  const [checked, setChecked] = useState(false)
  const [invite,setInvite]=useState(()=>kanbanInvite(window.location.hash))
  const [mode,setMode]=useState<'personal'|'shared'>(()=>kanbanInvite(window.location.hash) ? 'shared' : 'personal')
  useEffect(() => onAuthStateChanged(auth, account => { setUser(account); setChecked(true) }), [])
  useEffect(()=>{const change=()=>{const id=kanbanInvite(window.location.hash);setInvite(id);if(id)setMode('shared')};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change)},[])
  return <main className="kb-page">
    <button className="kb-back" onClick={onBack}><ChevronLeft size={18} /> Voltar para a agenda</button>
    <header className="kb-heading"><div><span className="kb-eyebrow">SEU ESPAÇO</span><h1>Meu Kanban</h1><p>Organize sozinho ou com seu grupo. Você escolhe o que compartilhar.</p></div><LockKeyhole size={24} aria-hidden="true" /></header>
    {!checked ? <p role="status">Conferindo sua conta…</p> : user ? <div key={user.uid}>
      <div className="kb-account"><span><LockKeyhole size={14}/>{user.email || 'Sua conta'}</span><button className="kb-link" onClick={()=>void signOut(auth).catch(()=>window.alert('Não foi possível sair. Tente novamente.'))}><LogOut size={14}/>Sair</button></div>
      <div className="kb-tabs" role="group" aria-label="Tipo de quadro"><button aria-pressed={mode==='personal'} onClick={()=>setMode('personal')}><LockKeyhole size={16}/> Pessoais</button><button aria-pressed={mode==='shared'} onClick={()=>setMode('shared')}><Users size={16}/> Compartilhados</button></div>
      {mode==='personal' ? <Workspace user={user}/> : <SharedKanban user={user} invite={invite}/>}
    </div> : <>{invite && <p className="kb-invite-note">Você recebeu um convite para um quadro compartilhado. Entre ou crie sua conta para pedir acesso ao dono.</p>}<KanbanLogin /></>}
  </main>
}

function KanbanLogin() {
  const [register, setRegister] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [email, setEmail] = useState(''), [password, setPassword] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      if (register) await createUserWithEmailAndPassword(auth,email.trim(),password)
      else await signInWithEmailAndPassword(auth,email.trim(),password)
      setPassword('')
    } catch { setError('Não foi possível entrar. Confira os dados. Para criar uma conta, use uma senha de pelo menos 6 caracteres.') }
    finally { setBusy(false) }
  }
  async function reset() {
    if (!email.trim()) { setError('Informe seu e-mail para receber o link.'); return }
    setBusy(true); setError(''); setNotice('')
    try { await requestPasswordReset(email.trim()); setNotice('Se houver uma conta com esse e-mail, você receberá o link. Confira também o spam ou lixo eletrônico.') }
    catch { setError('Não foi possível solicitar a recuperação. Tente novamente.') }
    finally { setBusy(false) }
  }
  return <section className="kb-login"><LayoutPanelLeft size={30} /><h2>Entre para organizar suas tarefas</h2><p>Use a mesma conta da Agenda. Não é preciso ser representante.</p>
    <form onSubmit={submit}><label>E-mail<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Senha<input type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 6 : undefined} value={password} onChange={e=>setPassword(e.target.value)} /></label>
      {error && <p className="kb-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'Aguarde…' : register ? 'Criar conta' : 'Entrar'}</button>
      <button type="button" className="kb-link" disabled={busy} onClick={()=>{setRegister(!register);setError('');setNotice('')}}>{register ? 'Já tenho uma conta' : 'Criar minha conta'}</button>
      <button type="button" className="kb-link" disabled={busy} onClick={()=>void reset()}>Esqueci minha senha</button>
    </form>
  </section>
}

type WorkspaceData = { ownerId:string; schemaVersion:1; boards:KanbanBoard[]; createdAt?:unknown }
type Editor = { kind:'board'; board?:KanbanBoard } | { kind:'column'; column?:KanbanColumn } | { kind:'task'; columnId:string; task?:KanbanTask }

function Workspace({user}:{user:User}) {
  const [workspace,setWorkspace] = useState<WorkspaceData | null>(null), [loading,setLoading] = useState(true), [error,setError] = useState(''), [notice,setNotice] = useState('')
  const busy=false
  const [stale,setStale] = useState(false), [reload,setReload] = useState(0)
  const [selected,setSelected] = useState(''), [search,setSearch] = useState(''), [priority,setPriority] = useState('')
  const [editor,setEditor] = useState<Editor | null>(null)
  const alive = useRef(true)
  useEffect(()=>{ alive.current=true; return ()=>{alive.current=false} },[])
  useEffect(()=>{
    let active=true,authorized=false
    setLoading(true);setError('');setNotice('')
    const ref=doc(db,'personalKanban',user.uid)
    const stopQueue=subscribeQueuedDocument(ref,state=>{
      if(!active || !authorized && !state.pending)return
      setWorkspace(queuedViewData<WorkspaceData>(state));setStale(!!state.failed);setError(state.failed?.message || '');setNotice(state.pending ? 'Alteração na fila de salvamento.' : 'Alterações confirmadas no banco.')
    })
    getDoc(ref).then(snapshot=>{
      if (!active || auth.currentUser?.uid!==user.uid) return
      authorized=true
      seedQueuedDocument(ref,'personal')
      const pending=queuedDocument(ref)
      if(pending?.pending){setWorkspace(queuedViewData<WorkspaceData>(pending));setStale(!!pending.failed);return}
      const data = snapshot.exists() ? snapshot.data() as WorkspaceData : {ownerId:user.uid,schemaVersion:1 as const,boards:[]}
      setWorkspace(data);setStale(false)
    }).catch(()=>{if(active){if(!queuedDocument(ref)?.pending)setWorkspace(null);setStale(true);setError('Não foi possível confirmar o acesso ao Kanban. Confira sua conta e tente recarregar.')}}).finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false;stopQueue()}
  },[user.uid,reload])
  const board=workspace?.boards.find(b=>b.id===selected) || workspace?.boards[0]
  const disabled=busy || loading || stale
  async function save(boards:KanbanBoard[]) {
    if (!workspace || stale || auth.currentUser?.uid!==user.uid) return false
    const limit=workspaceLimit(boards)
    if (limit) {setError(limit);return false}
    setError('')
    try {
      const ref=doc(db,'personalKanban',user.uid)
      enqueueDocument(ref,'personal',{boards},'Salvar meu Kanban')
      return true
    } catch (cause) {
      if (alive.current && auth.currentUser?.uid===user.uid) {
        const code=(cause as {code?:string}).code
        setError(code==='aborted' ? 'Seu Kanban mudou em outra aba. Recarregue para continuar com a versão atual.' : cause instanceof Error ? cause.message : 'Não foi possível colocar a alteração na fila.')
        setStale(code!=='resource-exhausted' && code!=='invalid-argument')
      }
      return false
    }
  }
  async function changeBoard(next:KanbanBoard) {return workspace ? save(replaceBoard(workspace.boards,next)) : false}
  function refresh() {
    if(queuedDocument(doc(db,'personalKanban',user.uid))?.pending){setError('Use a fila de salvamento para copiar ou revisar seus rascunhos antes de recarregar.');return}
    if (editor && !window.confirm('Recarregar e descartar as alterações ainda não salvas deste formulário?')) return
    setEditor(null);setReload(n=>n+1)
  }
  async function removeBoard() {
    if (!workspace || !board || !window.confirm(`Excluir o quadro “${board.name}” e suas ${board.tasks.length} tarefas? Esta ação não pode ser desfeita.`)) return
    if (await save(workspace.boards.filter(b=>b.id!==board.id))) setEditor(null)
  }
  if (loading) return <div className="kb-state" role="status">Carregando seus quadros…</div>
  if (!workspace) return <div className="kb-state"><p role="alert">{error}</p><button className="secondary-button" onClick={refresh}>Tentar novamente</button></div>
  const done=board?.tasks.filter(t=>board.columns.find(c=>c.id===t.columnId)?.done).length || 0
  return <>
    <div className="kb-feedback" aria-live="polite">{busy ? 'Salvando…' : notice}{error && <span className="kb-error" role="alert">{error}</span>}{(stale || error) && <button className="kb-link" disabled={busy} onClick={refresh}>Recarregar Kanban</button>}</div>
    <div className="kb-layout"><aside className="kb-boards" aria-label="Seus quadros"><h2>Meus quadros <span>{workspace.boards.length}/12</span></h2>
      <nav>{workspace.boards.map(b=><button key={b.id} className={b.id===board?.id ? 'active' : ''} aria-current={b.id===board?.id ? 'page' : undefined} onClick={()=>{setSelected(b.id);setSearch('');setPriority('');setNotice('')}}><i className={`kb-dot kb-color-${b.color}`}/><span>{b.name}</span><small>{b.tasks.length}</small></button>)}</nav>
      <button className="kb-add" disabled={disabled || workspace.boards.length>=12} onClick={()=>{setError('');setEditor({kind:'board'})}}><Plus size={16}/> Novo quadro</button>
      <p className="kb-private-note">Separado da agenda da turma. Representantes e administradores não têm acesso aos seus quadros.</p>
    </aside>
    <section className="kb-workarea" aria-label={board?.name || 'Criar seu primeiro quadro'}>
      {!board ? <div className="kb-empty"><LayoutPanelLeft size={36}/><h2>Comece pelo seu primeiro quadro</h2><p>Use um modelo de estudos, planeje sua semana ou comece do zero.</p><button className="primary-button" disabled={disabled} onClick={()=>setEditor({kind:'board'})}><Plus size={18}/> Criar meu quadro</button></div> : <>
        <header className="kb-board-heading"><div><span className={`kb-dot kb-color-${board.color}`}/><h2>{board.name}</h2><small>{done}/{board.tasks.length} concluídas</small></div><button className="secondary-button" disabled={disabled} onClick={()=>{setError('');setEditor({kind:'board',board})}}><Settings2 size={16}/> Personalizar quadro</button></header>
        <div className="kb-toolbar"><label className="kb-search"><Search size={17}/><input aria-label="Buscar tarefas pessoais" placeholder="Buscar tarefa ou etiqueta" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Filtrar prioridade" value={priority} onChange={e=>setPriority(e.target.value)}><option value="">Todas as prioridades</option>{Object.entries(PRIORITIES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button className="kb-add" disabled={disabled || board.columns.length>=12} onClick={()=>{setError('');setEditor({kind:'column'})}}><Plus size={16}/> Coluna</button></div>
        <p className="kb-hint">Arraste pelos seis pontos para organizar colunas e cartões. Use espaço e setas no teclado, ou “Mover para”. Soltar fora ou pressionar Escape cancela.</p>
        <KanbanBoardView key={board.id} board={board} disabled={disabled} search={search} priority={priority} canAddTask={workspace.boards.reduce((n,b)=>n+b.tasks.length,0)<200} onChange={changeBoard} onEditTask={task=>{setError('');setEditor({kind:'task',columnId:task.columnId,task})}} onEditColumn={column=>{setError('');setEditor({kind:'column',column})}} onAddTask={columnId=>{setError('');setEditor({kind:'task',columnId})}}/>
      </>}
    </section></div>
    {editor && <EditorDialog title={editor.kind==='board' ? editor.board ? 'Personalizar quadro' : 'Novo quadro' : editor.kind==='column' ? editor.column ? 'Editar coluna' : 'Nova coluna' : editor.task ? 'Editar tarefa' : 'Nova tarefa'} busy={busy} error={error} stale={stale} onReload={refresh} onClose={()=>{setEditor(null);setError('')}}>
      {editor.kind==='board' ? <BoardForm key={editor.board?.id || 'new'} board={editor.board} disabled={disabled} onDelete={()=>void removeBoard()} onDuplicate={workspace.boards.length<12 && editor.board ? async()=>{
        const copy=copyBoardTemplate(editor.board!)
        if(await save([...workspace.boards,copy])){setSelected(copy.id);setEditor(null)}
      } : undefined} onSave={async(name,color,compact,template)=>{
        const next=editor.board ? {...editor.board,name,color,compact} : createBoard(name,template,color)
        if (await save(editor.board ? replaceBoard(workspace.boards,next) : [...workspace.boards,next])) {setSelected(next.id);setEditor(null)}
      }}/> : editor.kind==='column' && board ? <ColumnForm key={editor.column?.id || 'new'} column={editor.column} disabled={disabled} onDelete={async()=>{
        try {const next=removeColumn(board,editor.column!.id);if(window.confirm(`Excluir a coluna “${editor.column!.name}”?`) && await changeBoard(next))setEditor(null)} catch(e){setError((e as Error).message)}
      }} onSave={async column=>{if(await changeBoard({...board,columns:editor.column ? board.columns.map(c=>c.id===column.id ? column : c) : [...board.columns,column]}))setEditor(null)}}/> : editor.kind==='task' && board ? <TaskForm key={editor.task?.id || 'new'} task={editor.task} columnId={editor.columnId} columns={board.columns} disabled={disabled} onDelete={async()=>{if(window.confirm(`Excluir a tarefa “${editor.task!.title}”?`) && await changeBoard({...board,tasks:board.tasks.filter(t=>t.id!==editor.task!.id)}))setEditor(null)}} onSave={async task=>{if(await changeBoard({...board,tasks:editor.task ? board.tasks.map(t=>t.id===task.id ? task : t) : [...board.tasks,task]}))setEditor(null)}}/> : null}
    </EditorDialog>}
  </>
}
