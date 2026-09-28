import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PeriodAgenda } from './PeriodAgenda'
import type { Activity, AdminProfile } from './types'

vi.mock('./attachments', () => ({ ATTACHMENTS_ENABLED: false }))
const activity: Activity = { id: 'one', title: 'Entrega do projeto', description: 'Conteúdo completo da tarefa', type: 'tarefa', subject: 'Desenvolvimento', date: '2026-09-28', time: '07:00', turmaId: '2° TECH D' }
const activitiesByDay = new Map([['2026-09-28', [activity]], ['2026-09-29', [{ ...activity, id: 'two', title: 'Prova amanhã', date: '2026-09-29', time: null }]]])
function render(view: 'day' | 'week', profile: AdminProfile | null = null) {
  return renderToStaticMarkup(<PeriodAgenda cursor={new Date(2026, 8, 28)} view={view} activitiesByDay={activitiesByDay} profile={profile} turmaId="2° TECH D" onAdd={vi.fn()} onEdit={vi.fn()} onOpenDay={vi.fn()} />)
}

describe('tarefas nas novas visões', () => {
  it('mostra só as tarefas do dia com o conteúdo completo', () => {
    const html = render('day')
    expect(html).toContain('Entrega do projeto')
    expect(html).toContain('Conteúdo completo da tarefa')
    expect(html).toContain('07:00')
    expect(html).not.toContain('Prova amanhã')
  })
  it('inclui tarefas da semana e identifica dias vazios e itens sem horário', () => {
    const html = render('week')
    expect(html).toContain('Entrega do projeto')
    expect(html).toContain('Prova amanhã')
    expect(html).toContain('Sem horário')
    expect(html).toContain('Sem atividades')
  })
  it('mantém ações administrativas restritas ao perfil e à turma', () => {
    expect(render('day')).not.toContain('Cadastrar atividade em')
    expect(render('day')).not.toContain('Editar Entrega')
    expect(render('day', { role: 'representante', turmaId: '2° TECH E' })).not.toContain('Cadastrar atividade em')
    expect(render('day', { role: 'representante', turmaId: '2° TECH D' })).toContain('Cadastrar atividade em')
    expect(render('day', { role: 'superadmin' })).toContain('Editar Entrega')
  })
})
