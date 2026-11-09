import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { ArrowLeft, ArrowRight, CalendarDays, CheckSquare, ChevronLeft, GripVertical, LayoutPanelLeft, LockKeyhole, LogOut, Plus, Search, Settings2, Trash2, X } from 'lucide-react'
import { auth, db } from './firebase'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from './dataClient'
import { requestPasswordReset } from './passwordReset'
import { dateKey } from './calendar'
import { copyBoardTemplate, createBoard, kanbanId, KANBAN_COLORS, KANBAN_TEMPLATES, moveTask, PRIORITIES, removeColumn, reorder, replaceBoard, taskMatches, taskOverdue, workspaceLimit, type KanbanBoard, type KanbanColor, type KanbanColumn, type KanbanTask, type KanbanTemplate } from './kanban'
import './kanban.css'

export default function KanbanPage({ onBack }: { onBack: () => void }) {
  const [user, setUser] = useState<User | null>(null)
  const [checked, setChecked] = useState(false)
  useEffect(() => onAuthStateChanged(auth, account => { setUser(account); setChecked(true) }), [])
  return <main className="kb-page">
    <button className="kb-back" onClick={onBack}><ChevronLeft size={18} /> Voltar para a agenda</button>
    <header className="kb-heading"><div><span className="kb-eyebrow">SEU ESPAÇO</span><h1>Meu Kanban</h1><p>Suas tarefas, do seu jeito. Só você pode ver e editar.</p></div><LockKeyhole size={24} aria-hidden="true" /></header>
    {!checked ? <p role="status">Conferindo sua conta…</p> : user ? <Workspace key={user.uid} user={user} /> : <KanbanLogin />}
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
type Drag = {kind:'task' | 'column'; id:string} | null

function Workspace({user}:{user:User}) {
  const [workspace,setWorkspace] = useState<WorkspaceData | null>(null), [loading,setLoading] = useState(true), [error,setError] = useState(''), [notice,setNotice] = useState('')
  const [busy,setBusy] = useState(false), [stale,setStale] = useState(false), [reload,setReload] = useState(0)
  const [selected,setSelected] = useState(''), [search,setSearch] = useState(''), [priority,setPriority] = useState('')
  const [editor,setEditor] = useState<Editor | null>(null), [drag,setDrag] = useState<Drag>(null)
  const lock = useRef(false), alive = useRef(true)
  useEffect(()=>{ alive.current=true; return ()=>{alive.current=false} },[])
  useEffect(()=>{
    let active=true
    setLoading(true);setError('');setNotice('')
    getDoc(doc(db,'personalKanban',user.uid)).then(snapshot=>{
      if (!active || auth.currentUser?.uid!==user.uid) return
      const data = snapshot.exists() ? snapshot.data() as WorkspaceData : {ownerId:user.uid,schemaVersion:1 as const,boards:[]}
      setWorkspace(data);setStale(false)
    }).catch(()=>{if(active) setError('Não foi possível carregar seu Kanban. Tente recarregar.')}).finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[user.uid,reload])
  const board=workspace?.boards.find(b=>b.id===selected) || workspace?.boards[0]
  const disabled=busy || loading || stale
  async function save(boards:KanbanBoard[]) {
    if (!workspace || lock.current || stale || auth.currentUser?.uid!==user.uid) return false
    const limit=workspaceLimit(boards)
    if (limit) {setError(limit);return false}
    lock.current=true;setBusy(true);setError('');setNotice('')
    try {
      const ref=doc(db,'personalKanban',user.uid)
      if (workspace.createdAt) await updateDoc(ref,{boards,updatedAt:serverTimestamp()})
      else await setDoc(ref,{ownerId:user.uid,schemaVersion:1,boards,createdAt:serverTimestamp(),updatedAt:serverTimestamp()})
      // Refresh the version only after saving, never silently overwrite a pending edit.
      const saved=await getDoc(ref)
      if (!alive.current || auth.currentUser?.uid!==user.uid) return false
      setWorkspace(saved.data() as WorkspaceData);setNotice('Alterações salvas.');return true
    } catch (cause) {
      if (alive.current && auth.currentUser?.uid===user.uid) {
        const code=(cause as {code?:string}).code
        setError(code==='aborted' ? 'Seu Kanban mudou em outra aba. Recarregue para continuar com a versão atual.' : 'Não foi possível confirmar o salvamento. Recarregue antes de tentar novamente; suas alterações podem já ter sido salvas.')
        setStale(true)
      }
      return false
    } finally {lock.current=false;if(alive.current)setBusy(false)}
  }
  async function changeBoard(next:KanbanBoard) {return workspace ? save(replaceBoard(workspace.boards,next)) : false}
  function refresh() {
    if (editor && !window.confirm('Recarregar e descartar as alterações ainda não salvas deste formulário?')) return
    setEditor(null);setReload(n=>n+1)
  }
  async function removeBoard() {
    if (!workspace || !board || !window.confirm(`Excluir o quadro “${board.name}” e suas ${board.tasks.length} tarefas? Esta ação não pode ser desfeita.`)) return
    if (await save(workspace.boards.filter(b=>b.id!==board.id))) setEditor(null)
  }
  async function drop(columnId:string,beforeId?:string) {
    const item=drag;setDrag(null)
    if (!item || !board || disabled) return
    if (item.kind==='task') await changeBoard(moveTask(board,item.id,columnId,beforeId))
    else if (!beforeId) await changeBoard({...board,columns:reorder(board.columns,item.id,columnId)})
  }
  if (loading) return <div className="kb-state" role="status">Carregando seus quadros…</div>
  if (!workspace) return <div className="kb-state"><p role="alert">{error}</p><button className="secondary-button" onClick={refresh}>Tentar novamente</button></div>
  const today=dateKey(new Date())
  const done=board?.tasks.filter(t=>board.columns.find(c=>c.id===t.columnId)?.done).length || 0
  return <>
    <div className="kb-account"><span><LockKeyhole size={14}/>{user.email || 'Sua conta'} · privado</span><button className="kb-link" disabled={busy} onClick={()=>void signOut(auth).catch(()=>setError('Não foi possível sair. Tente novamente.'))}><LogOut size={14}/>Sair</button></div>
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
        <p className="kb-hint">Arraste cartões para organizar. No celular ou teclado, use “Mover para” e as setas. Colunas marcadas como concluídas contam no progresso.</p>
        <div className={`kb-board${board.compact ? ' kb-compact' : ''}`}>
          {board.columns.map((column,columnIndex)=>{
            const tasks=board.tasks.filter(t=>t.columnId===column.id), visible=tasks.filter(t=>taskMatches(t,search,priority))
            return <section key={column.id} className={`kb-column kb-color-${column.color}${drag ? ' kb-droppable' : ''}`} aria-label={column.name} onDragOver={e=>{if(drag){e.preventDefault();e.dataTransfer.dropEffect='move'}}} onDrop={e=>{e.preventDefault();void drop(column.id)}}>
              <header className="kb-column-heading"><span className="kb-grab" draggable={!disabled} onDragStart={e=>{setDrag({kind:'column',id:column.id});e.dataTransfer.setData('text/plain',column.id);e.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setDrag(null)} title="Arrastar coluna"><GripVertical size={16}/></span><h3>{column.name}</h3><span className="kb-count">{tasks.length}</span>{column.done && <CheckSquare size={15} aria-label="Coluna de concluídas"/>}<button className="kb-icon" disabled={disabled} aria-label={`Configurar coluna ${column.name}`} onClick={()=>{setError('');setEditor({kind:'column',column})}}><Settings2 size={16}/></button></header>
              <div className="kb-column-order"><button className="kb-icon" disabled={disabled || columnIndex===0} aria-label={`Mover coluna ${column.name} para a esquerda`} onClick={()=>void changeBoard({...board,columns:reorder(board.columns,column.id,board.columns[columnIndex-1].id)})}><ArrowLeft size={14}/></button><button className="kb-icon" disabled={disabled || columnIndex===board.columns.length-1} aria-label={`Mover coluna ${column.name} para a direita`} onClick={()=>void changeBoard({...board,columns:reorder(board.columns,column.id,board.columns[columnIndex+1].id)})}><ArrowRight size={14}/></button></div>
              <div className="kb-cards">{visible.map((task,index)=><article className="kb-card" key={task.id} draggable={!disabled && !search && !priority} onDragStart={e=>{e.stopPropagation();setDrag({kind:'task',id:task.id});e.dataTransfer.setData('text/plain',task.id);e.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setDrag(null)} onDragOver={e=>{if(drag?.kind==='task')e.preventDefault()}} onDrop={e=>{if(drag?.kind==='task'){e.preventDefault();e.stopPropagation();void drop(column.id,task.id)}}}>
                <button className="kb-card-open" disabled={disabled} onClick={()=>{setError('');setEditor({kind:'task',columnId:column.id,task})}}><span className="kb-card-labels">{task.labels.map((label,i)=><span key={i}>{label}</span>)}</span><strong>{task.title}</strong>{task.description && <p>{task.description}</p>}<span className="kb-card-meta">{task.priority!=='none' && <span className={`kb-priority kb-priority-${task.priority}`}>{PRIORITIES[task.priority]}</span>}{task.dueDate && <span className={taskOverdue(task,column,today) ? 'kb-overdue' : ''}><CalendarDays size={13}/>{new Date(task.dueDate+'T12:00:00').toLocaleDateString('pt-BR')}{taskOverdue(task,column,today) ? ' · atrasada' : ''}</span>}{task.checklist.length>0 && <span><CheckSquare size={13}/>{task.checklist.filter(i=>i.done).length}/{task.checklist.length}</span>}</span></button>
                <div className="kb-card-actions"><label><span className="sr-only">Mover {task.title} para</span><select aria-label={`Mover ${task.title} para`} disabled={disabled} value={column.id} onChange={e=>void changeBoard(moveTask(board,task.id,e.target.value))}>{board.columns.map(c=><option key={c.id} value={c.id}>Mover para: {c.name}</option>)}</select></label><button className="kb-icon" aria-label={`Subir ${task.title}`} disabled={disabled || !!search || !!priority || index===0} onClick={()=>void changeBoard({...board,tasks:reorder(board.tasks,task.id,visible[index-1].id)})}>↑</button><button className="kb-icon" aria-label={`Descer ${task.title}`} disabled={disabled || !!search || !!priority || index===visible.length-1} onClick={()=>void changeBoard({...board,tasks:reorder(board.tasks,task.id,visible[index+1].id)})}>↓</button></div>
              </article>)}
              {!visible.length && <p className="kb-column-empty">{tasks.length ? 'Nenhuma tarefa com esse filtro.' : 'Nenhuma tarefa por aqui.'}</p>}</div>
              <button className="kb-add kb-new-task" disabled={disabled || workspace.boards.reduce((n,b)=>n+b.tasks.length,0)>=200} onClick={()=>{setError('');setEditor({kind:'task',columnId:column.id})}}><Plus size={16}/> Nova tarefa</button>
            </section>
          })}
        </div>
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

function EditorDialog({title,busy,error,stale,onReload,onClose,children}:{title:string;busy:boolean;error:string;stale:boolean;onReload:()=>void;onClose:()=>void;children:ReactNode}) {
  const ref=useRef<HTMLElement>(null), close=useRef(onClose), saving=useRef(busy)
  useEffect(()=>{close.current=onClose;saving.current=busy},[onClose,busy])
  useEffect(()=>{
    const prior=document.activeElement as HTMLElement | null, overflow=document.body.style.overflow
    document.body.style.overflow='hidden';(ref.current?.querySelector<HTMLElement>('input:not([type="checkbox"]),textarea,select') || ref.current?.querySelector<HTMLElement>('button'))?.focus()
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape' && !saving.current){e.preventDefault();close.current()}
      if(e.key!=='Tab')return
      const all=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') || [])
      if(!all.length){e.preventDefault();return}
      const first=all[0],last=all[all.length-1]
      if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus()}
    }
    document.addEventListener('keydown',key)
    return ()=>{document.removeEventListener('keydown',key);document.body.style.overflow=overflow;prior?.focus()}
  },[])
  return <div className="kb-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget && !busy)onClose()}}><section ref={ref} className="kb-editor" role="dialog" aria-modal="true" aria-labelledby="kb-editor-title"><header><h2 id="kb-editor-title">{title}</h2><button className="kb-icon" disabled={busy} onClick={onClose} aria-label="Fechar formulário"><X size={20}/></button></header><div className="kb-editor-body">{error && <div className="kb-error" role="alert">{error}{stale && <button className="kb-link" disabled={busy} onClick={onReload}>Recarregar Kanban</button>}</div>}{children}</div></section></div>
}
function ColorField({value,onChange}:{value:KanbanColor;onChange:(color:KanbanColor)=>void}) {
  return <label>Cor<select value={value} onChange={e=>onChange(e.target.value as KanbanColor)}>{Object.entries(KANBAN_COLORS).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
}
export function BoardForm({board,disabled,onSave,onDelete,onDuplicate}:{board?:KanbanBoard;disabled:boolean;onSave:(name:string,color:KanbanColor,compact:boolean,template:KanbanTemplate)=>Promise<void>;onDelete:()=>void;onDuplicate?:()=>Promise<void>}) {
  const [name,setName]=useState(board?.name || ''), [color,setColor]=useState<KanbanColor>(board?.color || 'blue'), [compact,setCompact]=useState(board?.compact || false), [template,setTemplate]=useState<KanbanTemplate>('simple')
  return <form className="kb-form" onSubmit={e=>{e.preventDefault();if(name.trim())void onSave(name.trim(),color,compact,template)}}><fieldset disabled={disabled}><label>Nome do quadro<input required maxLength={80} value={name} placeholder="Ex.: Estudos e entregas" onChange={e=>setName(e.target.value)}/></label><ColorField value={color} onChange={setColor}/>{!board && <label>Começar com<select value={template} onChange={e=>setTemplate(e.target.value as KanbanTemplate)}>{Object.entries(KANBAN_TEMPLATES).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>}{board && <label className="kb-check"><input type="checkbox" checked={compact} onChange={e=>setCompact(e.target.checked)}/> Cartões compactos (ocultar prévia da descrição)</label>}{onDuplicate && <div><button type="button" className="secondary-button" onClick={()=>void onDuplicate()}>Criar outro com este modelo</button><p className="kb-hint">Copia as colunas e o visual já salvos, sem copiar as tarefas.</p></div>}<div className="kb-form-actions">{board && <button type="button" className="kb-delete" onClick={onDelete}><Trash2 size={16}/> Excluir quadro</button>}<button className="primary-button" disabled={!name.trim()}>{board ? 'Salvar quadro' : 'Criar quadro'}</button></div></fieldset></form>
}
export function ColumnForm({column,disabled,onSave,onDelete}:{column?:KanbanColumn;disabled:boolean;onSave:(column:KanbanColumn)=>Promise<void>;onDelete:()=>Promise<void>}) {
  const [name,setName]=useState(column?.name || ''),[color,setColor]=useState<KanbanColor>(column?.color || 'blue'),[done,setDone]=useState(column?.done || false)
  return <form className="kb-form" onSubmit={e=>{e.preventDefault();if(name.trim())void onSave({id:column?.id || kanbanId(),name:name.trim(),color,done})}}><fieldset disabled={disabled}><label>Nome da coluna<input required maxLength={60} value={name} placeholder="Ex.: Aguardando retorno" onChange={e=>setName(e.target.value)}/></label><ColorField value={color} onChange={setColor}/><label className="kb-check"><input type="checkbox" checked={done} onChange={e=>setDone(e.target.checked)}/> Contar as tarefas desta coluna como concluídas</label><div className="kb-form-actions">{column && <button type="button" className="kb-delete" onClick={()=>void onDelete()}><Trash2 size={16}/> Excluir coluna</button>}<button className="primary-button" disabled={!name.trim()}>Salvar coluna</button></div></fieldset></form>
}
export function TaskForm({task,columnId,columns,disabled,onSave,onDelete}:{task?:KanbanTask;columnId:string;columns:KanbanColumn[];disabled:boolean;onSave:(task:KanbanTask)=>Promise<void>;onDelete:()=>Promise<void>}) {
  const [draft,setDraft]=useState<KanbanTask>(()=>task ? {...task,checklist:task.checklist.map(i=>({...i}))} : {id:kanbanId(),columnId,title:'',description:'',priority:'none',dueDate:null,labels:[],checklist:[]})
  const [labels,setLabels]=useState(task?.labels.join(', ') || ''), [item,setItem]=useState(''), [validation,setValidation]=useState('')
  const patch=(values:Partial<KanbanTask>)=>setDraft(d=>({...d,...values}))
  return <form className="kb-form" onSubmit={e=>{
    e.preventDefault();const tags=[...new Set(labels.split(',').map(s=>s.trim()).filter(Boolean))]
    if(tags.length>6 || tags.some(t=>t.length>30)){setValidation('Use até 6 etiquetas de até 30 caracteres, separadas por vírgulas.');return}
    const checklist=draft.checklist.map(i=>({...i,text:i.text.trim()}))
    if(item.trim() && checklist.length<20)checklist.push({id:kanbanId(),text:item.trim(),done:false})
    if(checklist.some(i=>!i.text)){setValidation('Preencha ou remova os itens vazios do checklist.');return}
    if(draft.title.trim())void onSave({...draft,title:draft.title.trim(),labels:tags,checklist})
  }}><fieldset disabled={disabled}><label>Título<input required maxLength={160} value={draft.title} onChange={e=>patch({title:e.target.value})}/></label><label>Descrição<textarea rows={4} maxLength={3000} value={draft.description} onChange={e=>patch({description:e.target.value})}/></label><div className="kb-fields"><label>Coluna<select value={draft.columnId} onChange={e=>patch({columnId:e.target.value})}>{columns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Prioridade<select value={draft.priority} onChange={e=>patch({priority:e.target.value as KanbanTask['priority']})}>{Object.entries(PRIORITIES).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><label>Prazo (opcional)<input type="date" min="1900-01-01" max="9999-12-31" value={draft.dueDate || ''} onChange={e=>patch({dueDate:e.target.value || null})}/></label></div><label>Etiquetas (opcional)<input maxLength={196} value={labels} onChange={e=>setLabels(e.target.value)} placeholder="Ex.: Matemática, Trabalho, Pessoal"/><small>Até 6 etiquetas, separadas por vírgulas.</small></label>
    <section className="kb-checklist"><h3>Checklist <small>{draft.checklist.filter(i=>i.done).length}/{draft.checklist.length}</small></h3>{draft.checklist.map((i,index)=><div className="kb-check-item" key={i.id}><input type="checkbox" aria-label={`Concluir ${i.text}`} checked={i.done} onChange={e=>patch({checklist:draft.checklist.map(it=>it.id===i.id ? {...it,done:e.target.checked} : it)})}/><input aria-label={`Item ${index+1} do checklist`} required maxLength={200} value={i.text} onChange={e=>patch({checklist:draft.checklist.map(it=>it.id===i.id ? {...it,text:e.target.value} : it)})}/><button type="button" className="kb-icon" aria-label={`Remover item ${index+1}`} onClick={()=>patch({checklist:draft.checklist.filter(it=>it.id!==i.id)})}><X size={16}/></button></div>)}<div className="kb-check-item"><input aria-label="Novo item do checklist" maxLength={200} value={item} placeholder="Adicionar etapa" disabled={draft.checklist.length>=20} onChange={e=>setItem(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(item.trim() && draft.checklist.length<20){patch({checklist:[...draft.checklist,{id:kanbanId(),text:item.trim(),done:false}]});setItem('')}}}}/><button type="button" className="secondary-button" disabled={!item.trim() || draft.checklist.length>=20} onClick={()=>{patch({checklist:[...draft.checklist,{id:kanbanId(),text:item.trim(),done:false}]});setItem('')}}><Plus size={16}/> Item</button></div></section>
    {validation && <p className="kb-error" role="alert">{validation}</p>}<div className="kb-form-actions">{task && <button type="button" className="kb-delete" onClick={()=>void onDelete()}><Trash2 size={16}/> Excluir tarefa</button>}<button className="primary-button" disabled={!draft.title.trim()}>Salvar tarefa</button></div></fieldset></form>
}
