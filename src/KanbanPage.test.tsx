import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BoardForm, ColumnForm, TaskForm } from './KanbanForms'
import { createBoard, type KanbanTask } from './kanban'
vi.mock('./firebase',()=>({auth:{currentUser:null},db:{}}))
const noop=async()=>{}
it('offers independent board templates and color customization',()=>{
  const html=renderToStaticMarkup(<BoardForm disabled={false} onSave={noop} onDelete={noop}/> )
  for(const text of ['Nome do quadro','Estudos','Minha semana','Do zero','Roxo','Rosa','Criar quadro'])expect(html).toContain(text)
  expect(html).not.toContain('Excluir quadro')
})
it('editing a board exposes density and explicit deletion, without replacing its model',()=>{
  const html=renderToStaticMarkup(<BoardForm board={createBoard('Projeto','simple')} disabled={false} onSave={noop} onDelete={noop}/> )
  expect(html).toContain('Cartões compactos');expect(html).toContain('Excluir quadro');expect(html).not.toContain('Começar com')
})
it('custom columns can define what counts as completed',()=>{
  const board=createBoard('Semana','week')
  const html=renderToStaticMarkup(<ColumnForm column={board.columns[0]} disabled={false} onSave={noop} onDelete={noop}/> )
  expect(html).toContain('Contar as tarefas desta coluna como concluídas')
  expect(html).toContain('Excluir coluna')
})
it('task editing includes custom columns, deadlines, priorities, labels and checklist with escaped text',()=>{
  const board=createBoard('Estudos','simple')
  const task:KanbanTask={id:'task',title:'<script>private</script>',description:'Revisar',columnId:board.columns[0].id,priority:'high',dueDate:'2026-11-09',labels:['Estudo'],checklist:[{id:'item',text:'Ler capítulo',done:true}]}
  const html=renderToStaticMarkup(<TaskForm task={task} columnId={task.columnId} columns={board.columns} disabled={false} onSave={noop} onDelete={noop}/> )
  for(const text of ['Prioridade','Prazo (opcional)','Etiquetas (opcional)','Checklist','Ler capítulo','Em andamento','Excluir tarefa'])expect(html).toContain(text)
  expect(html).toContain('&lt;script&gt;private&lt;/script&gt;');expect(html).not.toContain('<script>')
})
it('disables forms while saving or resolving concurrent edits',()=>{
  const html=renderToStaticMarkup(<BoardForm disabled={true} onSave={noop} onDelete={noop}/> )
  expect(html).toContain('<fieldset disabled="">')
})
it('does not offer board deletion to a participant',()=>{
  const html=renderToStaticMarkup(<BoardForm board={createBoard('Grupo','simple')} canDelete={false} disabled={false} onSave={noop} onDelete={noop}/> )
  expect(html).toContain('Salvar quadro');expect(html).not.toContain('Excluir quadro')
})
