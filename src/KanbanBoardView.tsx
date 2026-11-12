import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, rectIntersection, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, ArrowRight, CalendarDays, CheckSquare, GripVertical, Link2, Plus, Settings2, UserRound } from 'lucide-react'
import { dateKey } from './calendar'
import { moveTask, reorder, taskMatches, taskOverdue, PRIORITIES, type KanbanBoard, type KanbanColumn, type KanbanTask } from './kanban'

type Item = { kind:'task' | 'column'; id:string; columnId:string }
const columnKey=(id:string)=>'column:'+id, taskKey=(id:string)=>'task:'+id
const collisions:CollisionDetection=args=>{
  if(args.active.data.current?.kind==='column')return closestCenter({...args,droppableContainers:args.droppableContainers.filter(c=>c.data.current?.kind==='column')})
  const candidates=args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args)
  const task=candidates.find(c=>String(c.id).startsWith('task:') && c.id!==args.active.id)
  return task ? [task] : candidates.filter(c=>String(c.id).startsWith('column:')).slice(0,1)
}
function reducedMotion() {return document.documentElement.dataset.motion==='reduzido' || window.matchMedia('(prefers-reduced-motion: reduce)').matches}

export function KanbanBoardView({board,disabled,search,priority,canAddTask,onChange,onEditTask,onEditColumn,onAddTask,onInteractionChange,assignees=[]}:{board:KanbanBoard;disabled:boolean;search:string;priority:string;canAddTask:boolean;onChange:(board:KanbanBoard)=>Promise<boolean>;onEditTask:(task:KanbanTask)=>void;onEditColumn:(column:KanbanColumn)=>void;onAddTask:(columnId:string)=>void;onInteractionChange?:(active:boolean)=>void;assignees?:{uid:string;name:string}[]}) {
  const [active,setActive]=useState<(Item & {width:number}) | null>(null),[preview,setPreview]=useState<KanbanBoard | null>(null),[overColumn,setOverColumn]=useState<string | null>(null),[reduce,setReduce]=useState(false)
  const draft=useRef<KanbanBoard | null>(null), saving=useRef(false), mounted=useRef(true)
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:7}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}))
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  const view=preview || board, dragDisabled=disabled || saving.current
  function setDraft(next:KanbanBoard | null){draft.current=next;setPreview(next)}
  function start(event:DragStartEvent) {
    if(disabled || saving.current)return
    const data=event.active.data.current as Item
    onInteractionChange?.(true)
    setReduce(reducedMotion());setActive({...data,width:event.active.rect.current.initial?.width || 280});setDraft(board)
  }
  function over(event:DragOverEvent) {
    const current=draft.current, source=event.active.data.current as Item, target=event.over?.data.current as Item | undefined
    setOverColumn(target?.columnId || null)
    if(!current || source.kind!=='task' || !target)return
    const task=current.tasks.find(t=>t.id===source.id)
    if(task && task.columnId!==target.columnId)setDraft(moveTask(current,task.id,target.columnId,target.kind==='task' ? target.id : undefined))
  }
  function cancel(){setActive(null);setOverColumn(null);setDraft(null);onInteractionChange?.(false)}
  async function end(event:DragEndEvent) {
    const current=draft.current, source=event.active.data.current as Item, target=event.over?.data.current as Item | undefined
    onInteractionChange?.(false)
    setActive(null);setOverColumn(null)
    if(!current || !target){setDraft(null);return}
    let next=current
    if(source.kind==='column')next={...current,columns:reorder(current.columns,source.id,target.columnId)}
    else if(target.kind==='task' && source.id!==target.id){
      const rect=event.active.rect.current.translated,activator=event.activatorEvent as PointerEvent
      const y=typeof activator.clientY==='number' ? activator.clientY+event.delta.y : (rect?.top || 0)+(rect?.height || 0)/2
      next=moveTask(current,source.id,target.columnId,target.id,y>event.over!.rect.top+event.over!.rect.height/2)
    }
    else if(target.kind==='column')next=moveTask(current,source.id,target.columnId)
    if(JSON.stringify(next)===JSON.stringify(board)){setDraft(null);return}
    // Keep the final layout on screen while SQL confirms; cancellation never writes.
    setDraft(next);saving.current=true
    try{await onChange(next)}finally{saving.current=false;if(mounted.current)setDraft(null)}
  }
  const activeColumn=active?.kind==='column' ? view.columns.find(c=>c.id===active.id) : null
  const activeTask=active?.kind==='task' ? view.tasks.find(t=>t.id===active.id) : null
  const overlay=<DragOverlay zIndex={500} dropAnimation={reduce ? null : {duration:230,easing:'cubic-bezier(.2,.8,.2,1)'}}>{active && <div aria-hidden="true" className={`kb-drag-preview${view.compact ? ' kb-compact' : ''}`} style={{width:active.width}}>
    {activeColumn ? <div className={`kb-column kb-color-${activeColumn.color}`}><header className="kb-column-heading"><GripVertical size={16}/><h3>{activeColumn.name}</h3><span className="kb-count">{view.tasks.filter(t=>t.columnId===activeColumn.id).length}</span></header><div className="kb-cards">{view.tasks.filter(t=>t.columnId===activeColumn.id).slice(0,4).map(t=><div className="kb-card" key={t.id}><CardFace assignees={assignees} task={t} column={activeColumn}/></div>)}</div></div> : activeTask ? <div className="kb-card"><CardFace assignees={assignees} task={activeTask} column={view.columns.find(c=>c.id===activeTask.columnId)!}/></div> : null}
  </div>}</DragOverlay>
  return <DndContext sensors={sensors} collisionDetection={collisions} onDragStart={start} onDragOver={over} onDragCancel={cancel} onDragEnd={event=>void end(event)} accessibility={{screenReaderInstructions:{draggable:'Pressione espaço para arrastar. Use as setas para mover. Pressione espaço novamente para soltar ou Escape para cancelar.'},announcements:{onDragStart:()=> 'Item selecionado para mover.',onDragOver:({over})=>over ? 'Nova posição disponível. Solte para confirmar.' : 'Fora do quadro. Soltar aqui cancela a alteração.',onDragEnd:()=> 'Movimento finalizado.',onDragCancel:()=> 'Movimento cancelado. Nada foi alterado.'}}}>
    <div className={`kb-board${view.compact ? ' kb-compact' : ''}${active ? ' kb-sorting' : ''}`}>
      <SortableContext items={view.columns.map(c=>columnKey(c.id))} strategy={horizontalListSortingStrategy}>
        {view.columns.map((column,columnIndex)=>{
          const tasks=view.tasks.filter(t=>t.columnId===column.id),visible=tasks.filter(t=>taskMatches(t,search,priority))
          return <SortableColumn key={column.id} column={column} disabled={dragDisabled} reduce={reduce} targeted={active?.kind==='task' && overColumn===column.id} header={(handle)=><>
            <header className="kb-column-heading">{handle}<h3>{column.name}</h3><span className="kb-count">{tasks.length}</span>{column.done && <CheckSquare size={15} aria-label="Coluna de concluídas"/>}<button className="kb-icon" disabled={disabled} aria-label={`Configurar coluna ${column.name}`} onClick={()=>onEditColumn(column)}><Settings2 size={16}/></button></header>
            <div className="kb-column-order"><button className="kb-icon" disabled={disabled || columnIndex===0} aria-label={`Mover coluna ${column.name} para a esquerda`} onClick={()=>void onChange({...board,columns:reorder(board.columns,column.id,board.columns[columnIndex-1].id)})}><ArrowLeft size={14}/></button><button className="kb-icon" disabled={disabled || columnIndex===view.columns.length-1} aria-label={`Mover coluna ${column.name} para a direita`} onClick={()=>void onChange({...board,columns:reorder(board.columns,column.id,board.columns[columnIndex+1].id)})}><ArrowRight size={14}/></button></div>
          </>}>
            <SortableContext items={visible.map(t=>taskKey(t.id))} strategy={verticalListSortingStrategy}>
              <div className="kb-cards">{visible.map((task,index)=><SortableCard key={task.id} task={task} disabled={dragDisabled || !!search || !!priority} reduce={reduce}>
                <button className="kb-card-open" disabled={disabled} onClick={()=>onEditTask(task)}><CardFace assignees={assignees} task={task} column={column}/></button>
                <div className="kb-card-actions"><label><span className="sr-only">Mover {task.title} para</span><select aria-label={`Mover ${task.title} para`} disabled={disabled} value={column.id} onChange={e=>void onChange(moveTask(board,task.id,e.target.value))}>{view.columns.map(c=><option key={c.id} value={c.id}>Mover para: {c.name}</option>)}</select></label><button className="kb-icon" aria-label={`Subir ${task.title}`} disabled={disabled || !!search || !!priority || index===0} onClick={()=>void onChange({...board,tasks:reorder(board.tasks,task.id,visible[index-1].id)})}>↑</button><button className="kb-icon" aria-label={`Descer ${task.title}`} disabled={disabled || !!search || !!priority || index===visible.length-1} onClick={()=>void onChange({...board,tasks:reorder(board.tasks,task.id,visible[index+1].id)})}>↓</button></div>
              </SortableCard>)}{!visible.length && <p className="kb-column-empty">{active?.kind==='task' && overColumn===column.id ? 'Solte a tarefa aqui' : tasks.length ? 'Nenhuma tarefa com esse filtro.' : 'Nenhuma tarefa por aqui.'}</p>}</div>
            </SortableContext>
            <button className="kb-add kb-new-task" disabled={disabled || !canAddTask} onClick={()=>onAddTask(column.id)}><Plus size={16}/> Nova tarefa</button>
          </SortableColumn>
        })}
      </SortableContext>
    </div>
    {typeof document!=='undefined' ? createPortal(overlay,document.body) : null}
  </DndContext>
}

function SortableColumn({column,disabled,reduce,targeted,header,children}:{column:KanbanColumn;disabled:boolean;reduce:boolean;targeted:boolean;header:(handle:ReactNode)=>ReactNode;children:ReactNode}) {
  const {setNodeRef,setActivatorNodeRef,attributes,listeners,transform,transition,isDragging}=useSortable({id:columnKey(column.id),data:{kind:'column',id:column.id,columnId:column.id},disabled,transition:{duration:240,easing:'cubic-bezier(.2,.8,.2,1)'}})
  const style:CSSProperties={transform:CSS.Translate.toString(transform),transition:reduce ? 'none' : transition}
  return <section ref={setNodeRef} style={style} className={`kb-column kb-color-${column.color}${isDragging ? ' kb-drag-source' : ''}${targeted ? ' kb-drop-active' : ''}`} aria-label={column.name}>{header(<button type="button" ref={setActivatorNodeRef} className="kb-grab kb-drag-handle" disabled={disabled} {...attributes} {...listeners} aria-label={`Arrastar coluna ${column.name}`}><GripVertical size={16}/></button>)}{children}</section>
}
function SortableCard({task,disabled,reduce,children}:{task:KanbanTask;disabled:boolean;reduce:boolean;children:ReactNode}) {
  const {setNodeRef,setActivatorNodeRef,attributes,listeners,transform,transition,isDragging}=useSortable({id:taskKey(task.id),data:{kind:'task',id:task.id,columnId:task.columnId},disabled,transition:{duration:200,easing:'cubic-bezier(.2,.8,.2,1)'},animateLayoutChanges:args=>defaultAnimateLayoutChanges({...args,wasDragging:true})})
  return <article ref={setNodeRef} style={{transform:CSS.Translate.toString(transform),transition:reduce ? 'none' : transition}} className={`kb-card${isDragging ? ' kb-drag-source' : ''}`}><button type="button" ref={setActivatorNodeRef} className="kb-grab kb-card-grab kb-drag-handle" disabled={disabled} {...attributes} {...listeners} aria-label={`Arrastar tarefa ${task.title}`}><GripVertical size={15}/></button>{children}</article>
}
function CardFace({task,column,assignees}:{task:KanbanTask;column:KanbanColumn;assignees:{uid:string;name:string}[]}) {
  const overdue=taskOverdue(task,column,dateKey(new Date()))
  return <div className="kb-card-face"><span className="kb-card-labels">{task.labels.map((label,i)=><span key={i}>{label}</span>)}</span><strong>{task.title}</strong>{task.description && <p>{task.description}</p>}<span className="kb-card-meta">{task.assigneeId && <span className="kb-assignee"><UserRound size={13}/>{assignees.find(p=>p.uid===task.assigneeId)?.name || 'Participante indisponível'}</span>}{task.priority!=='none' && <span className={`kb-priority kb-priority-${task.priority}`}>{PRIORITIES[task.priority]}</span>}{task.dueDate && <span className={overdue ? 'kb-overdue' : ''}><CalendarDays size={13}/>{new Date(task.dueDate+'T12:00:00').toLocaleDateString('pt-BR')}{overdue ? ' · atrasada' : ''}</span>}{Boolean(task.activityIds?.length) && <span><Link2 size={13}/>{task.activityIds!.length} {task.activityIds!.length===1 ? 'atividade vinculada' : 'atividades vinculadas'}</span>}{task.checklist.length>0 && <span><CheckSquare size={13}/>{task.checklist.filter(i=>i.done).length}/{task.checklist.length}</span>}</span></div>
}
