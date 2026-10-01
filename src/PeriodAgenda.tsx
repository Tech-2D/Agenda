import { Edit3, Plus } from 'lucide-react'
import { dateKey, isToday } from './calendar'
import { periodDays } from './calendarViews'
import { canCreateForSelectedClass } from './quickCreate'
import { canEditCalendarActivity } from './calendarPermissions'
import { AttachmentLinks } from './AttachmentLinks'
import { ATTACHMENTS_ENABLED } from './attachments'
import { ACTIVITY_TYPE_COLORS, ACTIVITY_TYPE_LABELS, type Activity, type AdminProfile } from './types'

export function PeriodAgenda({ cursor, view, activitiesByDay, profile, turmaId, showTurmaLabel = false, onAdd, onEdit, onOpenDay }: {
  cursor: Date; view: 'day' | 'week'; activitiesByDay: Map<string, Activity[]>; profile: AdminProfile | null; turmaId: string | null
  showTurmaLabel?: boolean
  onAdd: (day: Date) => void; onEdit: (activity: Activity) => void; onOpenDay: (day: Date) => void
}) {
  return <div className={`period-agenda ${view}`}>
    {periodDays(cursor, view).map(day => {
      const key = dateKey(day)
      const activities = activitiesByDay.get(key) ?? []
      return <section className={`period-day ${isToday(day) ? 'today' : ''}`} key={key} aria-label={day.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}>
        <div className="period-day-heading">
          <button type="button" className="period-day-date" onClick={() => onOpenDay(day)}>
            <span>{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
            <strong>{day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</strong>
            {isToday(day) && <small>Hoje</small>}
          </button>
          {canCreateForSelectedClass(profile, turmaId) && <button type="button" className="icon-button" onClick={() => onAdd(day)} aria-label={`Cadastrar atividade em ${day.toLocaleDateString('pt-BR')}`}><Plus size={16} /></button>}
        </div>
        <div className="period-tasks">
          {!activities.length && <p className="period-empty">Sem atividades</p>}
          {activities.map(activity => <article key={activity.id} className="period-task" style={{ borderLeftColor: ACTIVITY_TYPE_COLORS[activity.type] }}>
            <div className="period-task-meta"><span>{activity.time || 'Sem horário'}</span><span>{ACTIVITY_TYPE_LABELS[activity.type]}{activity.turmaId === null ? ' · Geral' : showTurmaLabel ? ` · ${activity.turmaId}` : ''}</span></div>
            <h2>{activity.title}</h2>
            {activity.subject && <p className="activity-subject">{activity.subject}</p>}
            {activity.description && <p className="period-task-description">{activity.description}</p>}
            {ATTACHMENTS_ENABLED && <AttachmentLinks activityId={activity.id} attachments={activity.attachments} />}
            {canEditCalendarActivity(profile, activity) && <button type="button" className="period-edit" onClick={() => onEdit(activity)} aria-label={`Editar ${activity.title}`}><Edit3 size={14} /> Editar</button>}
          </article>)}
        </div>
      </section>
    })}
  </div>
}
