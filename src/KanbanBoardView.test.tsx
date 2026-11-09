import {expect,it,vi} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {KanbanBoardView} from './KanbanBoardView'
import {createBoard} from './kanban'
it('renders explicit accessible drag handles without native browser dragging',()=>{
  const board=createBoard('Meu quadro','simple')
  board.tasks=[{id:'task',columnId:board.columns[0].id,title:'Estudar',description:'Revisão',priority:'high',dueDate:null,labels:['Prova'],checklist:[]}]
  const html=renderToStaticMarkup(<KanbanBoardView board={board} disabled={false} search="" priority="" canAddTask={true} onChange={async()=>true} onEditTask={vi.fn()} onEditColumn={vi.fn()} onAddTask={vi.fn()}/> )
  expect(html).toContain('Arrastar coluna A fazer');expect(html).toContain('Arrastar tarefa Estudar')
  expect(html).toContain('Mover Estudar para');expect(html).toContain('kb-drag-handle')
  expect(html).not.toContain('draggable="true"')
})
it('empty custom columns remain drop areas and respect permission controls',()=>{
  const board=createBoard('Meu quadro','blank')
  const html=renderToStaticMarkup(<KanbanBoardView board={board} disabled={true} search="" priority="" canAddTask={false} onChange={async()=>true} onEditTask={vi.fn()} onEditColumn={vi.fn()} onAddTask={vi.fn()}/> )
  expect(html).toContain('Nenhuma tarefa por aqui.');expect(html).toContain('Arrastar coluna Minhas tarefas')
  expect(html).toContain('disabled=""')
})
