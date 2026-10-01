import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, DoorOpen, LoaderCircle, X } from 'lucide-react'
import { WEEKDAY_LABELS, compareActivities, dateKey, getMonthMatrix, isToday } from './calendar'
import { CALENDAR_VIEWS, movePeriod, periodTitle, type CalendarView } from './calendarViews'
import { PeriodAgenda } from './PeriodAgenda'
import { observeCatalog } from './publicQueries'
import { readCompareTurmas, saveCompareTurmas, shortTurmaLabel, toggleTurma } from './compareTurmas'
import { ATTACHMENTS_ENABLED } from './attachments'
import { AttachmentLinks } from './AttachmentLinks'
import { ACTIVITY_TYPE_COLORS, ACTIVITY_TYPE_LABELS, type Activity } from './types'

// Modo só de consulta: ver as atividades de várias turmas juntas no mesmo
// calendário. Não cria nem edita nada — isso continua só na agenda de uma
// turma só. A API pública não libera uma busca sem turma (CORS), então
// fazemos uma consulta por turma marcada, em paralelo — cada uma já volta
// com os eventos gerais dela também, por isso deduplicamos pelo id.
export function CompareCalendar({ classNames, currentTurmaId, onBack }: { classNames: string[]; currentTurmaId: string | null; onBack: () => void }) {
  const [byTurma, setByTurma] = useState<Record<string, Activity[]>>({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  // Sem nada salvo ainda, vem pré-marcada a turma que a pessoa já tinha escolhido.
  const [turmas, setTurmas] = useState<string[]>(() => {
    const saved = readCompareTurmas(classNames)
    if (saved.length > 0) return saved
    return currentTurmaId && classNames.includes(currentTurmaId) ? [currentTurmaId] : []
  })
  const [calendarView, setCalendarView] = useState<CalendarView>('month')
  const [monthCursor, setMonthCursor] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  useEffect(() => {
    if (turmas.length === 0) {
      setByTurma({})
      setLoading(false)
      setLoadError('')
      return
    }
    setLoading(true)
    setLoadError('')
    const loadedTurmas = new Set<string>()
    const stops = turmas.map((turmaId) =>
      observeCatalog<{ activities: Activity[] }>('agenda', (data) => {
        loadedTurmas.add(turmaId)
        setByTurma((current) => ({ ...current, [turmaId]: data.activities }))
        if (loadedTurmas.size === turmas.length) setLoading(false)
        setLoadError('')
      }, () => {
        setLoading(false)
        if (!loadedTurmas.has(turmaId)) setLoadError(`Não foi possível carregar as atividades de ${turmaId}. Tente novamente em alguns minutos.`)
      }, turmaId),
    )
    return () => stops.forEach((stop) => stop())
  }, [turmas])

  function toggle(turmaId: string) {
    setTurmas((current) => {
      const next = toggleTurma(current, turmaId)
      saveCompareTurmas(next)
      return next
    })
  }

  const activities = useMemo(() => {
    const seen = new Map<string, Activity>()
    for (const turmaId of turmas) {
      for (const activity of byTurma[turmaId] ?? []) seen.set(activity.id, activity)
    }
    return [...seen.values()]
  }, [byTurma, turmas])

  const activitiesByDay = useMemo(() => {
    const map = new Map<string, Activity[]>()
    for (const activity of activities) {
      const list = map.get(activity.date) ?? []
      list.push(activity)
      map.set(activity.date, list)
    }
    for (const list of map.values()) list.sort(compareActivities)
    return map
  }, [activities])

  const weeks = useMemo(() => getMonthMatrix(monthCursor.getFullYear(), monthCursor.getMonth()), [monthCursor])

  return (
    <div className="agenda-toolbar">
      <div className="agenda-heading">
        <button type="button" className="secondary-button" onClick={onBack}><ArrowLeft size={16} /> Voltar</button>
        <h1>Comparar turmas</h1>
      </div>

      <div className="compare-chips" role="group" aria-label="Turmas para comparar">
        {classNames.length === 0 && <p className="polls-note">Nenhuma turma disponível ainda.</p>}
        {classNames.map((name) => (
          <button key={name} type="button" className={`compare-chip ${turmas.includes(name) ? 'active' : ''}`} aria-pressed={turmas.includes(name)} onClick={() => toggle(name)}>
            {name}
          </button>
        ))}
      </div>

      <div className="agenda-controls">
        <div className="calendar-view-tools">
          <div className="calendar-view-switch" role="group" aria-label="Visualização da agenda">
            {CALENDAR_VIEWS.map((view) => <button key={view.id} type="button" aria-pressed={calendarView === view.id} onClick={() => setCalendarView(view.id)}>{view.label}</button>)}
          </div>
          <div className="month-nav">
            <button type="button" onClick={() => setMonthCursor((current) => movePeriod(current, calendarView, -1))} aria-label={calendarView === 'month' ? 'Mês anterior' : calendarView === 'week' ? 'Semana anterior' : 'Dia anterior'}><ChevronLeft /></button>
            <div className="month-nav-title">
              <strong aria-live="polite">{periodTitle(monthCursor, calendarView)}</strong>
              <button type="button" className="today-button" onClick={() => setMonthCursor(new Date())}>Hoje</button>
            </div>
            <button type="button" onClick={() => setMonthCursor((current) => movePeriod(current, calendarView, 1))} aria-label={calendarView === 'month' ? 'Próximo mês' : calendarView === 'week' ? 'Próxima semana' : 'Próximo dia'}><ChevronRight /></button>
          </div>
        </div>
      </div>

      {turmas.length === 0 && (
        <p className="polls-note">Marque pelo menos uma turma acima para ver as atividades dela e os eventos gerais aqui.</p>
      )}

      <section className="calendar-section" aria-label={calendarView === 'month' ? 'Calendário mensal comparando turmas' : calendarView === 'week' ? 'Calendário semanal comparando turmas' : 'Calendário diário comparando turmas'}>
        {loading ? (
          <div className="state-card"><LoaderCircle className="spin" /><p>Consultando as atividades…</p></div>
        ) : loadError ? (
          <div className="state-card error"><DoorOpen /><p>{loadError}</p></div>
        ) : calendarView !== 'month' ? (
          <PeriodAgenda cursor={monthCursor} view={calendarView} activitiesByDay={activitiesByDay} profile={null} turmaId={null} showTurmaLabel onAdd={() => {}} onEdit={() => {}} onOpenDay={setSelectedDay} />
        ) : (
          <div className="calendar-grid">
            <div className="calendar-weekdays">{WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}</div>
            {weeks.map((week, weekIndex) => (
              <div className="calendar-week" key={weekIndex}>
                {week.map((day) => {
                  const key = dateKey(day)
                  const dayActivities = activitiesByDay.get(key) ?? []
                  const outside = day.getMonth() !== monthCursor.getMonth()
                  const visible = dayActivities.slice(0, 2)
                  const overflow = dayActivities.length - visible.length
                  return (
                    <button
                      type="button"
                      key={key}
                      className={`calendar-day ${outside ? 'outside' : ''} ${isToday(day) ? 'today' : ''}`}
                      onClick={() => setSelectedDay(day)}
                      aria-label={`Abrir ${day.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}${dayActivities.length ? `, ${dayActivities.length} atividade${dayActivities.length === 1 ? '' : 's'}` : ', sem atividades'}`}
                    >
                      <span className="day-number">{day.getDate()}</span>
                      <span className="day-chips">
                        {visible.map((activity) => (
                          <span key={activity.id} className="activity-chip">
                            <span className={`chip-dot ${activity.turmaId === null ? 'general' : ''}`} style={{ background: ACTIVITY_TYPE_COLORS[activity.type] }} />
                            <span className="chip-label">{activity.turmaId === null ? '' : `${shortTurmaLabel(activity.turmaId)} · `}{activity.title}</span>
                          </span>
                        ))}
                        {overflow > 0 && <span className="chip-overflow">+{overflow}</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedDay && <CompareDayDetail day={selectedDay} activities={activitiesByDay.get(dateKey(selectedDay)) ?? []} onClose={() => setSelectedDay(null)} />}
    </div>
  )
}

function CompareDayDetail({ day, activities, onClose }: { day: Date; activities: Activity[]; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="day-dialog" role="dialog" aria-modal="true" aria-labelledby="compare-day-title">
        <div className="dialog-header">
          <h2 id="compare-day-title">{day.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        <div className="day-dialog-list">
          {activities.length === 0 && <p className="day-empty">Nenhuma atividade das turmas marcadas nesta data.</p>}
          {activities.map((activity) => (
            <article key={activity.id} className="activity-detail" style={{ borderLeftColor: ACTIVITY_TYPE_COLORS[activity.type] }}>
              <div className="activity-detail-heading">
                <span className="type-badge" style={{ background: ACTIVITY_TYPE_COLORS[activity.type] }}>{ACTIVITY_TYPE_LABELS[activity.type]}</span>
                <span className="type-badge general-badge">{activity.turmaId === null ? 'Geral' : activity.turmaId}</span>
                {activity.time && <span className="activity-time">{activity.time}</span>}
              </div>
              <h3>{activity.title}</h3>
              {activity.subject && <p className="activity-subject">{activity.subject}</p>}
              {activity.description && <p>{activity.description}</p>}
              {ATTACHMENTS_ENABLED && <AttachmentLinks activityId={activity.id} attachments={activity.attachments} />}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
