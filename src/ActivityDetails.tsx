import type { CSSProperties } from 'react'
import { BookOpen, Clock3, Edit3, FileText, Paperclip, Repeat2, Users } from 'lucide-react'
import { AttachmentLinks } from './AttachmentLinks'
import { ActivityShareButton } from './ActivityShareButton'
import { ATTACHMENTS_ENABLED } from './attachments'
import { ACTIVITY_TYPE_COLORS, ACTIVITY_TYPE_LABELS, type Activity } from './types'
import './activityDetails.css'

export function ActivityDetails({ activity, onEdit }: { activity: Activity; onEdit?: () => void }) {
  const [year, month, day] = activity.date.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const files = ATTACHMENTS_ENABLED ? activity.attachments || [] : []
  const paragraphs = activity.description.trim().split(/\n\s*\n/).filter(Boolean)
  return <article className="activity-sheet" aria-label={activity.title} style={{ '--activity-color': ACTIVITY_TYPE_COLORS[activity.type] } as CSSProperties}>
    <header className="activity-sheet-heading">
      <div className="activity-sheet-tags"><span className="type-badge" style={{ background: ACTIVITY_TYPE_COLORS[activity.type] }}>{ACTIVITY_TYPE_LABELS[activity.type]}</span>{activity.recurringId && <span className="activity-sheet-recurring"><Repeat2 size={13} /> Recorrente</span>}</div>
      <h3>{activity.title}</h3>
    </header>
    <div className="activity-sheet-date">
      <div className="activity-date-stamp" aria-hidden="true"><strong>{String(day).padStart(2, '0')}</strong><span>{date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span></div>
      <div><span className="activity-field-label">Data da atividade</span><time dateTime={activity.date}>{date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</time><span className="activity-sheet-time"><Clock3 size={15} />{activity.time ? <time dateTime={`${activity.date}T${activity.time}`}>{activity.time}</time> : 'Sem horário definido'}</span></div>
    </div>
    <dl className="activity-sheet-facts">
      <div><dt><BookOpen size={15} /> Matéria</dt><dd>{activity.subject || 'Não informada'}</dd></div>
      <div><dt><Users size={15} /> Turma</dt><dd>{activity.turmaId || 'Geral · todas as turmas'}</dd></div>
    </dl>
    <section className="activity-sheet-section" aria-label="Orientações da atividade"><h4><FileText size={17} /> Orientações</h4>{paragraphs.length ? paragraphs.map((text, index) => <p key={index}>{text}</p>) : <p className="activity-sheet-empty">Não foram adicionadas orientações para esta atividade.</p>}</section>
    {files.length > 0 && <section className="activity-sheet-section activity-sheet-files" aria-label="Materiais e anexos"><h4><Paperclip size={17} /> Materiais e anexos <span>{files.length}</span></h4><AttachmentLinks activityId={activity.id} attachments={files} showTitle={false} /></section>}
    <footer className="activity-sheet-actions"><ActivityShareButton activityId={activity.id} />{onEdit && <button type="button" className="secondary-button" onClick={onEdit} aria-label={`Editar ${activity.title}`}><Edit3 size={16} /> Editar atividade</button>}</footer>
  </article>
}
