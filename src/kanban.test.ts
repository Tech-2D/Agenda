import { describe, expect, it } from 'vitest'
import { copyBoardTemplate, createBoard, moveTask, removeColumn, reorder, taskMatches, taskOverdue, workspaceLimit, type KanbanTask } from './kanban'
const board=()=>createBoard('  Estudos  ','study')
const task=(columnId:string,id='task'):KanbanTask=>({id,columnId,title:'Revisão de Matemática',description:'Capítulo de trigonometria',priority:'high',dueDate:'2026-11-09',labels:['Prova'],checklist:[{id:'step',text:'Ler',done:false}]})
describe('Kanban pessoal',()=>{
  it('reuses a personal model without copying tasks or column IDs',()=>{
    const original=board();original.tasks=[task(original.columns[0].id)]
    const copy=copyBoardTemplate(original)
    expect(copy.tasks).toEqual([]);expect(copy.id).not.toBe(original.id)
    expect(copy.columns[0].id).not.toBe(original.columns[0].id)
    const appearance=(c:typeof original.columns[number])=>({name:c.name,color:c.color,done:c.done})
    expect(copy.columns.map(appearance)).toEqual(original.columns.map(appearance))
    expect(copy.color).toBe(original.color)
  })
  it('creates independent templates without demo tasks or shared IDs',()=>{
    const a=board(),b=board()
    expect(a.name).toBe('Estudos');expect(a.tasks).toEqual([])
    expect(a.columns.map(c=>c.name)).toEqual(['Para estudar','Estudando','Revisar','Concluído'])
    expect(a.id).not.toBe(b.id);expect(a.columns[0].id).not.toBe(b.columns[0].id)
    expect(a.columns.at(-1)?.done).toBe(true)
    expect(createBoard('Meu modelo','blank').columns).toHaveLength(1)
  })
  it('moves a task between custom columns while preserving details',()=>{
    const a=board();a.tasks=[task(a.columns[0].id)]
    const moved=moveTask(a,'task',a.columns[2].id)
    expect(moved.tasks[0]).toEqual({...a.tasks[0],columnId:a.columns[2].id})
    expect(a.tasks[0].columnId).toBe(a.columns[0].id)
    expect(moveTask(a,'task','missing')).toBe(a)
  })
  it('orders cards at a drop target and appends to a column',()=>{
    const a=board(),[c1,c2]=a.columns
    a.tasks=[task(c1.id,'a'),task(c2.id,'b'),task(c2.id,'c')]
    expect(moveTask(a,'a',c2.id,'c').tasks.map(t=>t.id)).toEqual(['b','a','c'])
    expect(moveTask(a,'a',c2.id,'c',true).tasks.map(t=>t.id)).toEqual(['b','c','a'])
    expect(moveTask(a,'a',c2.id).tasks.map(t=>t.id)).toEqual(['b','c','a'])
    expect(moveTask(a,'a',c1.id,'a')).toBe(a)
  })
  it('allows keyboard ordering without mutating source arrays',()=>{
    const original=[{id:'a'},{id:'b'},{id:'c'}]
    expect(reorder(original,'a','c').map(i=>i.id)).toEqual(['b','c','a'])
    expect(original.map(i=>i.id)).toEqual(['a','b','c'])
    expect(reorder(original,'unknown','a')).toBe(original)
  })
  it('refuses to lose tasks or remove the last column',()=>{
    const a=board();a.tasks=[task(a.columns[0].id)]
    expect(()=>removeColumn(a,a.columns[0].id)).toThrow('Mova as tarefas')
    expect(removeColumn(a,a.columns[1].id).columns).toHaveLength(3)
    const blank=createBoard('Do zero','blank')
    expect(()=>removeColumn(blank,blank.columns[0].id)).toThrow('pelo menos uma coluna')
  })
  it('filters by title, description and tags without accent/case sensitivity',()=>{
    const t=task('column')
    expect(taskMatches(t,'matematica','')).toBe(true)
    expect(taskMatches(t,'PROVA','high')).toBe(true)
    expect(taskMatches(t,'trigonometria','')).toBe(true)
    expect(taskMatches(t,'','low')).toBe(false)
  })
  it('only marks deadlines before today and excludes completed columns',()=>{
    const a=board(),t=task(a.columns[0].id)
    expect(taskOverdue(t,a.columns[0],'2026-11-09')).toBe(false)
    expect(taskOverdue(t,a.columns[0],'2026-11-10')).toBe(true)
    expect(taskOverdue(t,a.columns.at(-1)!,'2026-11-10')).toBe(false)
    expect(taskOverdue({...t,dueDate:null},a.columns[0],'2026-11-10')).toBe(false)
  })
  it('enforces workspace limits before sending a write',()=>{
    expect(workspaceLimit([board()])).toBe('')
    expect(workspaceLimit(Array.from({length:13},board))).toContain('12 quadros')
    const a=board();a.tasks=Array.from({length:201},(_,i)=>task(a.columns[0].id,String(i)))
    expect(workspaceLimit([a])).toContain('200 tarefas')
    expect(workspaceLimit([{...board(),columns:Array.from({length:13},()=>board().columns[0])}])).toContain('12 colunas')
  })
})
