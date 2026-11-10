export const KANBAN_COLORS = { blue: 'Azul', purple: 'Roxo', pink: 'Rosa', green: 'Verde', orange: 'Laranja', slate: 'Cinza' } as const
export type KanbanColor = keyof typeof KANBAN_COLORS
export const PRIORITIES = { none: 'Sem prioridade', low: 'Baixa', medium: 'Média', high: 'Alta' } as const
export type KanbanTask = { id: string; columnId: string; title: string; description: string; priority: keyof typeof PRIORITIES; dueDate: string | null; labels: string[]; checklist: { id: string; text: string; done: boolean }[]; assigneeId?:string | null }
export type KanbanColumn = { id: string; name: string; color: KanbanColor; done: boolean }
export type KanbanBoard = { id: string; name: string; color: KanbanColor; compact: boolean; columns: KanbanColumn[]; tasks: KanbanTask[] }
export const KANBAN_TEMPLATES = { simple: 'Básico', study: 'Estudos', week: 'Minha semana', blank: 'Do zero' } as const
export type KanbanTemplate = keyof typeof KANBAN_TEMPLATES
export const kanbanId = () => crypto.randomUUID()
export function createBoard(name: string, template: KanbanTemplate, color: KanbanColor = 'blue'): KanbanBoard {
  const labels = { simple: ['A fazer','Em andamento','Concluído'], study: ['Para estudar','Estudando','Revisar','Concluído'], week: ['Planejar','Segunda','Terça','Quarta','Quinta','Sexta','Concluído'], blank: ['Minhas tarefas'] }[template]
  return { id: kanbanId(), name: name.trim(), color, compact: false, columns: labels.map((label,index)=>({ id:kanbanId(), name:label, color:label === 'Concluído' ? 'green' : index === 1 ? 'orange' : color, done:label === 'Concluído' })), tasks:[] }
}
export function replaceBoard(boards: KanbanBoard[], board: KanbanBoard) {
  return boards.map(b=>b.id === board.id ? board : b)
}
export function copyBoardTemplate(board: KanbanBoard): KanbanBoard {
  return {...board,id:kanbanId(),name:board.name.slice(0,69)+' (modelo)',columns:board.columns.map(c=>({...c,id:kanbanId()})),tasks:[]}
}
export function reorder<T extends {id:string}>(items: T[], source: string, target: string): T[] {
  const from = items.findIndex(i=>i.id===source), to = items.findIndex(i=>i.id===target)
  if (from < 0 || to < 0 || from === to) return items
  const result = [...items], [item] = result.splice(from,1)
  result.splice(to,0,item)
  return result
}
export function moveTask(board: KanbanBoard, taskId: string, columnId: string, beforeId?: string, after = false): KanbanBoard {
  const task = board.tasks.find(t=>t.id===taskId)
  if (!task || !board.columns.some(c=>c.id===columnId) || beforeId === taskId) return board
  const tasks = board.tasks.filter(t=>t.id!==taskId)
  const index = beforeId ? tasks.findIndex(t=>t.id===beforeId && t.columnId===columnId) : -1
  tasks.splice(index < 0 ? tasks.length : index + (after ? 1 : 0),0,{...task,columnId})
  return {...board,tasks}
}
export function removeColumn(board: KanbanBoard, columnId: string): KanbanBoard {
  if (board.columns.length <= 1) throw Error('O quadro precisa ter pelo menos uma coluna.')
  if (board.tasks.some(t=>t.columnId===columnId)) throw Error('Mova as tarefas desta coluna antes de excluí-la.')
  return {...board,columns:board.columns.filter(c=>c.id!==columnId)}
}
export function taskMatches(task: KanbanTask, search: string, priority: string) {
  const normalized = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR')
  return (!priority || task.priority===priority) && normalized([task.title,task.description,...task.labels].join(' ')).includes(normalized(search.trim()))
}
export function taskOverdue(task: KanbanTask, column: KanbanColumn, today: string) { return !column.done && !!task.dueDate && task.dueDate < today }
export function workspaceLimit(boards: KanbanBoard[]) {
  if (boards.length > 12) return 'Você pode manter até 12 quadros.'
  if (boards.some(b=>b.columns.length>12)) return 'Cada quadro pode ter até 12 colunas.'
  if (boards.reduce((sum,b)=>sum+b.tasks.length,0) > 200) return 'Você pode manter até 200 tarefas. Exclua tarefas antigas para liberar espaço.'
  if (new TextEncoder().encode(JSON.stringify(boards)).length > 740000) return 'Seu Kanban está muito grande. Reduza descrições ou exclua tarefas antigas.'
  return ''
}
