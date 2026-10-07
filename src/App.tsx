import { Component, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, GripVertical, Bell, BookOpen, Calendar, CalendarClock, Check, ChevronLeft, ChevronRight, DoorOpen, Edit3, ExternalLink, History, LayoutGrid, KeyRound, Lightbulb, ListChecks, LoaderCircle, MapPin, Menu, MessageSquarePlus, Plus, Settings, StickyNote, UserRound, Vote, X } from 'lucide-react'
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { requestPasswordReset } from './passwordReset'
import { WeeklyDigestSettings } from './WeeklyDigestSettings'
import { AttachmentLinks } from './AttachmentLinks'
import { ATTACHMENTS_ENABLED } from './attachments'
import { FirebaseError } from 'firebase/app'
import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'
import { CLASS_NAMES } from './classNames'
import { SUBJECTS } from './subjects'
import { MyFeedbackConversations } from './FeedbackConversation'
import { canEditCalendarActivity } from './calendarPermissions'
import { observeCalendarSession } from './calendarSession'
import { CALENDAR_VIEWS, movePeriod, periodTitle, type CalendarView } from './calendarViews'
import { PeriodAgenda } from './PeriodAgenda'
import { WEEKDAY_LABELS, compareActivities, dateKey, getMonthMatrix, isToday } from './calendar'
import { ACTIVITY_TYPES, ACTIVITY_TYPE_COLORS, ACTIVITY_TYPE_LABELS, SUGGESTION_STATUS_LABELS, type Activity, type ActivityInput, type ActivityType, type AdminProfile, type Announcement, type Suggestion, type SuggestionInput } from './types'
import { addMySuggestionId, readMySuggestionIds, removeMySuggestionId } from './mySuggestions'
import { markNotificationsSeenNow, readLastSeen } from './notifications'
import { markAnnouncementSeen, readAnnouncementSeenAt } from './announcementSeen'
import { canCreateForSelectedClass } from './quickCreate'
import { activeNotices, canManageNotices } from './notices'
import { useNow, useTurmaNotices } from './useNotices'
import { readPreferredTurma, savePreferredTurma } from './classPreference'
import { teacherFinderTodayUrl } from './teacherFinder'
import { observeCatalog, type CatalogMeta } from './publicQueries'
import { latestUnseenUpdate, markSystemUpdateSeen, readSeenSystemUpdateId, type SystemUpdate } from './systemUpdates'
import { NEON_COLORS, NEON_COLOR_LABELS, NEON_COLOR_SWATCHES, THEME_LABELS, THEME_PREVIEW, THEMES, readStoredNeon, readStoredTheme, storeNeon, storeTheme, type NeonColor, type Theme } from './theme'
import { FONT_SCALES, FONT_SCALE_LABELS, readStoredFontScale, readStoredHighContrast, readStoredReduceMotion, storeFontScale, storeHighContrast, storeReduceMotion, type FontScale } from './accessibility'
import { loadOrClaimAdminProfile } from './adminAccess'
import { DEFAULT_MENU_SHORTCUTS, readMenuShortcuts, storeMenuShortcuts, type MenuShortcutId } from './menuShortcuts'

const CompareCalendar = lazy(() => import('./CompareCalendar').then(module => ({ default: module.CompareCalendar })))
const ProfileDialog = lazy(() => import('./ProfileDialog').then(module => ({ default: module.ProfileDialog })))
const ClassRequestDialog = lazy(() => import('./ClassRequestDialog').then(module => ({ default: module.ClassRequestDialog })))
const PollsDialog = lazy(() => import('./PollsDialog').then(module => ({ default: module.PollsDialog })))
const NoticeBoardDialog = lazy(() => import('./NoticeBoard').then(module => ({ default: module.NoticeBoardDialog })))
const AdminDialog = lazy(() => import('./AdminDialog'))

const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

function updatedAtMs(activity: Activity): number {
  return activity.updatedAt?.toDate().getTime() ?? 0
}

function createdAtMs(activity: Activity): number {
  return activity.createdAt?.toDate().getTime() ?? 0
}

const emptyForm: Omit<ActivityInput, 'turmaId'> = {
  title: '',
  description: '',
  type: 'tarefa',
  subject: null,
  date: dateKey(new Date()),
  time: null,
}

function App() {
  const [turmaId, setTurmaId] = useState<string | null>(readPreferredTurma)
  const [classNames, setClassNames] = useState<string[]>([...CLASS_NAMES])
  const [classRequestOpen, setClassRequestOpen] = useState(false)
  const [subjectFilter, setSubjectFilter] = useState('')
  const [turmaActivities, setTurmaActivities] = useState<Activity[]>([])
  const [globalActivities, setGlobalActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [cacheNotice, setCacheNotice] = useState('')
  const [monthCursor, setMonthCursor] = useState(() => new Date())
  const [calendarView, setCalendarView] = useState<CalendarView>('month')
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [dayPreview, setDayPreview] = useState<{ key: string; day: Date; activities: Activity[]; left: number; top: number; width: number } | null>(null)
  const previewCloseTimer = useRef<number | null>(null)
  const [adminOpen, setAdminOpen] = useState(['#admin', '#representante'].includes(window.location.hash))
  const [quickCreateDate, setQuickCreateDate] = useState<string | null>(null)
  const [quickEditActivity, setQuickEditActivity] = useState<Activity | null>(null)
  const [calendarProfile, setCalendarProfile] = useState<AdminProfile | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuShortcuts, setMenuShortcuts] = useState(readMenuShortcuts)
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(window.location.hash === '#opcoes')
  const [compareMode, setCompareMode] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [profilesOpen, setProfilesOpen] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [mySuggestionsOpen, setMySuggestionsOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [pollsOpen, setPollsOpen] = useState(false)
  const [noticesOpen, setNoticesOpen] = useState(false)
  const [calendarUser, setCalendarUser] = useState<User | null>(null)
  const [docsOpen, setDocsOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsSeenAt, setNotificationsSeenAt] = useState(0)
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [announcementSeenAt, setAnnouncementSeenAt] = useState(readAnnouncementSeenAt)
  const [systemUpdates, setSystemUpdates] = useState<SystemUpdate[]>([])
  const [updatesReady, setUpdatesReady] = useState(false)
  const [updatesError, setUpdatesError] = useState('')
  const [updatesOpen, setUpdatesOpen] = useState(false)
  const [seenSystemUpdateId, setSeenSystemUpdateId] = useState(readSeenSystemUpdateId)
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const [neon, setNeonState] = useState<NeonColor>(readStoredNeon)
  const [fontScale, setFontScaleState] = useState<FontScale>(readStoredFontScale)
  const [highContrast, setHighContrastState] = useState(readStoredHighContrast)
  const [reduceMotion, setReduceMotionState] = useState(readStoredReduceMotion)

  function setTheme(value: Theme) {
    setThemeState(value)
    storeTheme(value)
  }

  useEffect(() => {
    return observeCalendarSession({
      subscribeAccount: change => onAuthStateChanged(auth, account => { setCalendarUser(account); change(account?.uid ?? null) }),
      subscribeProfile: (uid, change, error) => onSnapshot(doc(db, 'admins', uid), snapshot => change(snapshot.data() as AdminProfile ?? null), error),
      publish: setCalendarProfile,
      reset: () => { setQuickCreateDate(null); setQuickEditActivity(null) },
    })
  }, [])


  function setNeon(value: NeonColor) {
    setNeonState(value)
    storeNeon(value)
  }

  function setFontScale(value: FontScale) {
    setFontScaleState(value)
    storeFontScale(value)
  }

  function setHighContrast(value: boolean) {
    setHighContrastState(value)
    storeHighContrast(value)
  }

  function setReduceMotion(value: boolean) {
    setReduceMotionState(value)
    storeReduceMotion(value)
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.neon = neon
  }, [theme, neon])

  useEffect(() => {
    document.documentElement.dataset.fontScale = fontScale
  }, [fontScale])

  useEffect(() => {
    if (highContrast) document.documentElement.dataset.contrast = 'alto'
    else delete document.documentElement.dataset.contrast
  }, [highContrast])

  useEffect(() => {
    if (reduceMotion) document.documentElement.dataset.motion = 'reduzido'
    else delete document.documentElement.dataset.motion
  }, [reduceMotion])

  useEffect(() => {
    document.title = turmaId ? `Agenda — ${turmaId}` : 'Agenda da turma'
  }, [turmaId])

  useEffect(() => {
    setNotificationsSeenAt(turmaId ? readLastSeen(turmaId) : 0)
  }, [turmaId])


  const unseenSystemUpdate = updatesReady && !updatesError
    ? latestUnseenUpdate(systemUpdates, seenSystemUpdateId)
    : null
  const showSystemUpdate = unseenSystemUpdate && !adminOpen && !updatesOpen

  const announcementUpdatedMs = announcement?.updatedAt?.toDate().getTime() ?? 0
  const showAnnouncement = Boolean(turmaId) && announcementUpdatedMs > 0 && announcementUpdatedMs > announcementSeenAt

  useEffect(() => {
    const syncOptionsPage = () => setMoreOptionsOpen(window.location.hash === '#opcoes')
    window.addEventListener('hashchange', syncOptionsPage)
    window.addEventListener('popstate', syncOptionsPage)
    return () => {
      window.removeEventListener('hashchange', syncOptionsPage)
      window.removeEventListener('popstate', syncOptionsPage)
    }
  }, [])

  function chooseTurma(value: string) {
    setTurmaId(value)
    savePreferredTurma(value)
  }

  useEffect(() => {
    let loaded = false
    setLoading(true)
    setTurmaActivities([])
    type PublicAgenda = { activities: Activity[]; classes: string[]; announcement: Announcement | null; updates: SystemUpdate[]; meta: CatalogMeta }
    return observeCatalog<PublicAgenda>('agenda', data => {
      loaded = true
      setClassNames([...new Set([...CLASS_NAMES, ...data.classes])].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })))
      setTurmaActivities(turmaId ? data.activities.filter(item => item.turmaId === turmaId) : [])
      setGlobalActivities(data.activities.filter(item => item.turmaId === null))
      setAnnouncement(data.announcement)
      setSystemUpdates(data.updates)
      setUpdatesReady(true)
      setUpdatesError('')
      setLoading(false)
      setLoadError('')
      setCacheNotice(data.meta.stale ? 'Exibindo os últimos dados disponíveis. A atualização está temporariamente indisponível.' : '')
    }, () => {
      setLoading(false)
      setUpdatesReady(true)
      if (loaded) setCacheNotice('Exibindo os últimos dados carregados. Não foi possível atualizá-los agora.')
      else {
        setLoadError('Não foi possível carregar a agenda. Tente novamente em alguns minutos.')
        setUpdatesError('Não foi possível carregar as atualizações. Tente novamente mais tarde.')
      }
    }, turmaId || undefined)
  }, [turmaId])

  const activities = useMemo(() => {
    const merged = [...turmaActivities, ...globalActivities]
    return subjectFilter ? merged.filter((activity) => activity.subject === subjectFilter) : merged
  }, [turmaActivities, globalActivities, subjectFilter])

  const recentActivities = useMemo(() => {
    const threshold = Date.now() - RECENT_WINDOW_MS
    return activities
      .filter((activity) => updatedAtMs(activity) >= threshold)
      .sort((a, b) => updatedAtMs(b) - updatedAtMs(a))
  }, [activities])

  const unseenNotifications = recentActivities.filter((activity) => updatedAtMs(activity) > notificationsSeenAt).length

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
  const boardNotices = useTurmaNotices(turmaId)
  const noticesNow = useNow()
  const visibleNotices = useMemo(() => activeNotices(boardNotices.notices, noticesNow), [boardNotices.notices, noticesNow])

  useEffect(() => () => {
    if (previewCloseTimer.current !== null) window.clearTimeout(previewCloseTimer.current)
  }, [])

  function keepDayPreviewOpen() {
    if (previewCloseTimer.current !== null) window.clearTimeout(previewCloseTimer.current)
    previewCloseTimer.current = null
  }

  function closeDayPreviewSoon() {
    keepDayPreviewOpen()
    previewCloseTimer.current = window.setTimeout(() => setDayPreview(null), 150)
  }

  function showDayPreview(button: HTMLButtonElement, day: Date, activities: Activity[]) {
    if (!activities.length) return
    keepDayPreviewOpen()
    const rect = button.getBoundingClientRect()
    const width = Math.min(360, window.innerWidth - 24)
    const left = rect.right + width + 12 < window.innerWidth
      ? rect.right + 8
      : Math.max(12, rect.left - width - 8)
    const top = Math.max(12, Math.min(rect.top, window.innerHeight - Math.min(500, window.innerHeight - 24) - 12))
    setDayPreview({ key: dateKey(day), day, activities, left, top, width })
  }

  const openAdmin = () => {
    window.location.hash = 'admin'
    setAdminOpen(true)
  }

  const openMoreOptions = () => {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}#opcoes`)
    setMoreOptionsOpen(true)
    setMenuOpen(false)
    window.scrollTo(0, 0)
  }

  const closeMoreOptions = () => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    setMoreOptionsOpen(false)
  }

  const leaveMoreOptions = () => {
    if (!moreOptionsOpen) return
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    setMoreOptionsOpen(false)
  }

  const openAdminForDay = (day: Date) => {
    if (!canCreateForSelectedClass(calendarProfile, turmaId)) return
    setQuickEditActivity(null)
    setQuickCreateDate(dateKey(day))
    openAdmin()
  }

  const openCalendarEdit = (activity: Activity) => {
    if (!canEditCalendarActivity(calendarProfile, activity)) return
    setQuickCreateDate(null)
    setQuickEditActivity(activity)
    setSelectedDay(null)
    openAdmin()
  }

  const closeAdmin = () => {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    setAdminOpen(false)
    setQuickCreateDate(null)
    setQuickEditActivity(null)
  }

  const menuAction = (action: () => void) => () => {
    setMenuOpen(false)
    leaveMoreOptions()
    action()
  }
  const menuSections = menuOptionSections({
    turmaId,
    onOpenNotifications: menuAction(() => { setNotificationsOpen(true); if (turmaId) setNotificationsSeenAt(markNotificationsSeenNow(turmaId)) }),
    onOpenUpdates: menuAction(() => setUpdatesOpen(true)),
    onOpenPolls: menuAction(() => setPollsOpen(true)),
    onOpenNotices: menuAction(() => setNoticesOpen(true)),
    onSuggestActivity: menuAction(() => setSuggestOpen(true)),
    onRequestClass: menuAction(() => setClassRequestOpen(true)),
    onOpenFeedback: menuAction(() => setFeedbackOpen(true)),
    onOpenMySuggestions: menuAction(() => setMySuggestionsOpen(true)),
    onOpenAdmin: menuAction(openAdmin),
    onOpenConfig: menuAction(() => setConfigOpen(true)),
    onOpenProfiles: menuAction(() => setProfilesOpen(true)),
    onOpenDocs: menuAction(() => setDocsOpen(true)),
  })

  function toggleMenuShortcut(id: MenuShortcutId) {
    const next = menuShortcuts.includes(id) ? menuShortcuts.filter(item => item !== id) : [...menuShortcuts, id]
    setMenuShortcuts(next)
    storeMenuShortcuts(next)
  }

  function resetMenuShortcuts() {
    const next = [...DEFAULT_MENU_SHORTCUTS]
    setMenuShortcuts(next)
    storeMenuShortcuts(next)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Agenda da turma — início">
          <span className="brand-mark"><Calendar size={21} strokeWidth={2.3} /></span>
          <span>Agenda da turma</span>
        </a>
        <button
          type="button"
          className="menu-trigger"
          aria-label="Abrir menu"
          aria-haspopup="dialog"
          title="Menu"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={20} strokeWidth={2.3} aria-hidden="true" />
          {unseenNotifications > 0 && <span className="notif-dot" aria-hidden="true" />}
        </button>
      </header>

      {moreOptionsOpen ? (
        <MoreOptionsPage
          turmaId={turmaId}
          onBack={closeMoreOptions}
          sections={menuSections}
          shortcuts={menuShortcuts}
          onToggleShortcut={toggleMenuShortcut}
          onResetShortcuts={resetMenuShortcuts}
        />
      ) : compareMode ? (
      <main id="inicio" className="main-content">
        <Suspense fallback={<div className="state-card"><LoaderCircle className="spin" /><p>Carregando…</p></div>}>
          <CompareCalendar classNames={classNames} currentTurmaId={turmaId} onBack={() => setCompareMode(false)} />
        </Suspense>
      </main>
      ) : (
      <main id="inicio" className="main-content">
        <div className="agenda-toolbar">
          <div className="agenda-heading">
            <h1>Sua agenda</h1>
            <label className="turma-select-inline" aria-label="Turma selecionada">
              <select value={turmaId ?? ''} onChange={(event) => chooseTurma(event.target.value)}>
                <option value="" disabled>Selecione uma turma</option>
                {classNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            {turmaId && (
              <label className="turma-select-inline" aria-label="Filtrar por matéria">
                <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
                  <option value="">Todas as matérias</option>
                  {SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                </select>
              </label>
            )}
            <button type="button" className="compare-link" onClick={() => setCompareMode(true)}>
              <LayoutGrid size={14} aria-hidden="true" /> Comparar turmas
            </button>
          </div>

          <div className="agenda-controls">
          <div className="calendar-view-tools">
          <div className="calendar-view-switch" role="group" aria-label="Visualização da agenda">
            {CALENDAR_VIEWS.map(view => <button key={view.id} type="button" aria-pressed={calendarView === view.id} onClick={() => { setCalendarView(view.id); setDayPreview(null) }}>{view.label}</button>)}
          </div>
          <div className="month-nav">
            <button type="button" onClick={() => { setDayPreview(null); setMonthCursor((current) => movePeriod(current, calendarView, -1)) }} aria-label={calendarView === 'month' ? 'Mês anterior' : calendarView === 'week' ? 'Semana anterior' : 'Dia anterior'}><ChevronLeft /></button>
            <div className="month-nav-title">
              <strong aria-live="polite">{periodTitle(monthCursor, calendarView)}</strong>
              <button type="button" className="today-button" onClick={() => { setDayPreview(null); setMonthCursor(new Date()) }}>Hoje</button>
            </div>
            <button type="button" onClick={() => { setDayPreview(null); setMonthCursor((current) => movePeriod(current, calendarView, 1)) }} aria-label={calendarView === 'month' ? 'Próximo mês' : calendarView === 'week' ? 'Próxima semana' : 'Próximo dia'}><ChevronRight /></button>
          </div>
          </div>

          {turmaId && (
            <div className="agenda-actions">
              <button type="button" className="action-button" aria-label={`Quadro de avisos${visibleNotices.length ? `, ${visibleNotices.length} ativos` : ''}`} title="Quadro de avisos" onClick={() => setNoticesOpen(true)}>
                <StickyNote size={14} aria-hidden="true" /><span className="action-label">Quadro de avisos</span>
                {visibleNotices.length > 0 && <span className="action-badge">{visibleNotices.length}</span>}
              </button>
              <button type="button" className="action-button" aria-label="Enquetes da turma" title="Enquetes da turma" onClick={() => setPollsOpen(true)}>
                <Vote size={14} aria-hidden="true" /><span className="action-label">Enquetes da turma</span>
              </button>
              <button type="button" className="action-button" aria-label="Sugerir atividade" title="Sugerir atividade" onClick={() => setSuggestOpen(true)}>
                <Lightbulb size={14} aria-hidden="true" /><span className="action-label">Sugerir atividade</span>
              </button>
              <a className="action-button" aria-label="Aulas de hoje no Cadê o professor?" title="Aulas de hoje" href={teacherFinderTodayUrl(turmaId)} target="_blank" rel="noopener noreferrer">
                <CalendarClock size={14} aria-hidden="true" /><span className="action-label">Aulas de hoje</span>
              </a>
            </div>
          )}
          </div>
        </div>

        <section className="calendar-section" aria-label={calendarView === 'month' ? 'Calendário mensal' : calendarView === 'week' ? 'Calendário semanal' : 'Calendário diário'}>
          {cacheNotice && <p className="form-notice" role="status">{cacheNotice}</p>}
          {!turmaId ? (
            <div className="state-card"><Calendar /><p>Escolha sua turma para ver a agenda.</p></div>
          ) : loading ? (
            <div className="state-card"><LoaderCircle className="spin" /><p>Consultando a agenda…</p></div>
          ) : loadError ? (
            <div className="state-card error"><DoorOpen /><p>{loadError}</p></div>
          ) : calendarView !== 'month' ? (
            <PeriodAgenda cursor={monthCursor} view={calendarView} activitiesByDay={activitiesByDay} profile={calendarProfile} turmaId={turmaId} onAdd={openAdminForDay} onEdit={openCalendarEdit} onOpenDay={setSelectedDay} />
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
                        onClick={() => { setDayPreview(null); setSelectedDay(day) }}
                        onMouseEnter={(event) => showDayPreview(event.currentTarget, day, dayActivities)}
                        onMouseLeave={closeDayPreviewSoon}
                        onFocus={(event) => showDayPreview(event.currentTarget, day, dayActivities)}
                        onBlur={closeDayPreviewSoon}
                        aria-describedby={dayPreview?.key === key ? 'calendar-day-preview' : undefined}
                        aria-label={`Abrir ${day.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}${dayActivities.length ? `, ${dayActivities.length} atividade${dayActivities.length === 1 ? '' : 's'}` : ', sem atividades'}`}
                      >
                        <span className="day-number">{day.getDate()}</span>
                        <span className="day-chips">
                          {visible.map((activity) => (
                            <span key={activity.id} className="activity-chip">
                              <span className={`chip-dot ${activity.turmaId === null ? 'general' : ''}`} style={{ background: ACTIVITY_TYPE_COLORS[activity.type] }} />
                              <span className="chip-label">{activity.title}</span>
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
      </main>
      )}

      <DialogLoadBoundary>
      <Suspense fallback={<div className="modal-backdrop" role="status" aria-live="polite"><div className="state-card"><LoaderCircle className="spin" /><p>Carregando…</p></div></div>}>
      {dayPreview && createPortal(
        <div
          id="calendar-day-preview"
          className="calendar-day-preview"
          role="tooltip"
          style={{ left: dayPreview.left, top: dayPreview.top, width: dayPreview.width }}
          onMouseEnter={keepDayPreviewOpen}
          onMouseLeave={closeDayPreviewSoon}
        >
          <strong className="preview-date">{dayPreview.day.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
          <div className="preview-activities">
            {dayPreview.activities.map((activity) => (
              <div key={activity.id} className="preview-activity">
                <span className="preview-activity-type"><span className="chip-dot" style={{ background: ACTIVITY_TYPE_COLORS[activity.type] }} />{ACTIVITY_TYPE_LABELS[activity.type]}{activity.time ? ` · ${activity.time}` : ''}{activity.turmaId === null ? ' · Geral' : ''}</span>
                <strong>{activity.title}</strong>
                {activity.subject && <span className="preview-subject">{activity.subject}</span>}
                {activity.description && <p>{activity.description}</p>}
                {ATTACHMENTS_ENABLED && <AttachmentLinks activityId={activity.id} attachments={activity.attachments} />}
                {activity.createdByEmail && <span className="preview-author">Publicado por {activity.createdByEmail}</span>}
              </div>
            ))}
          </div>
          <span className="preview-footnote">Clique no dia para abrir os detalhes.</span>
        </div>,
        document.body,
      )}

      {selectedDay && (
        <DayDetail day={selectedDay} activities={activitiesByDay.get(dateKey(selectedDay)) ?? []} profile={calendarProfile} canAdd={canCreateForSelectedClass(calendarProfile, turmaId)} onEditActivity={openCalendarEdit} onAddActivity={() => openAdminForDay(selectedDay)} onClose={() => setSelectedDay(null)} />
      )}

      {!turmaId && !classRequestOpen && <TurmaPickerModal classNames={classNames} onChoose={chooseTurma} onRequest={() => setClassRequestOpen(true)} />}

      {menuOpen && (
        <SideMenu
          onClose={() => setMenuOpen(false)}
          options={menuSections.flatMap(section => section.items)}
          shortcuts={menuShortcuts}
          onOpenMoreOptions={openMoreOptions}
          onReorder={next => { setMenuShortcuts(next); storeMenuShortcuts(next) }}
          latestUpdateIsNew={Boolean(unseenSystemUpdate)}
          unseenNotifications={unseenNotifications}
        />
      )}

      {docsOpen && <DocsDialog onClose={() => setDocsOpen(false)} />}
      {profilesOpen && <ProfileDialog onClose={() => setProfilesOpen(false)} />}

      {updatesOpen && <SystemUpdatesDialog onClose={() => setUpdatesOpen(false)} />}

      {suggestOpen && turmaId && <SuggestDialog turmaId={turmaId} onClose={() => setSuggestOpen(false)} />}

      {mySuggestionsOpen && <MySuggestionsDialog onClose={() => setMySuggestionsOpen(false)} />}

      {feedbackOpen && <FeedbackDialog turmaId={turmaId} onClose={() => setFeedbackOpen(false)} />}

      {pollsOpen && turmaId && <PollsDialog turmaId={turmaId} loadAdminProfile={loadOrClaimAdminProfile} onClose={() => setPollsOpen(false)} />}

      {noticesOpen && turmaId && (
        <NoticeBoardDialog
          turmaId={turmaId}
          notices={visibleNotices}
          loading={boardNotices.loading}
          error={boardNotices.error}
          user={calendarUser}
          canManage={canManageNotices(calendarProfile, turmaId)}
          onClose={() => setNoticesOpen(false)}
        />
      )}

      {notificationsOpen && <NotificationsDialog activities={recentActivities} onClose={() => setNotificationsOpen(false)} />}

      {showAnnouncement && announcement && updatesReady && !showSystemUpdate && (
        <AnnouncementModal
          message={announcement.message}
          onClose={() => {
            markAnnouncementSeen(announcementUpdatedMs)
            setAnnouncementSeenAt(announcementUpdatedMs)
          }}
        />
      )}

      {configOpen && (
        <ConfigDialog
          theme={theme}
          neon={neon}
          onSetTheme={setTheme}
          onSetNeon={setNeon}
          fontScale={fontScale}
          onSetFontScale={setFontScale}
          highContrast={highContrast}
          onSetHighContrast={setHighContrast}
          reduceMotion={reduceMotion}
          onSetReduceMotion={setReduceMotion}
          onClose={() => setConfigOpen(false)}
        />
      )}

      {classRequestOpen && <ClassRequestDialog classNames={classNames} onClose={() => setClassRequestOpen(false)} />}
      {adminOpen && <AdminDialog publicTurmaId={turmaId} classNames={classNames} quickCreateDate={quickCreateDate} quickEditActivity={quickEditActivity} systemUpdates={systemUpdates} onClose={closeAdmin} />}

      {showSystemUpdate && unseenSystemUpdate && (
        <SystemUpdateWelcome update={unseenSystemUpdate} onClose={() => {
          markSystemUpdateSeen(unseenSystemUpdate.id)
          setSeenSystemUpdateId(unseenSystemUpdate.id)
        }} />
      )}

      </Suspense>
      </DialogLoadBoundary>
      <VLibrasWidget />
    </div>
  )
}

class DialogLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <div className="modal-backdrop" role="alert"><div className="state-card">
      <DoorOpen /><p>Não foi possível carregar esta tela. Confira a conexão e atualize a página.</p>
      <button type="button" className="primary-button compact" onClick={() => window.location.reload()}>Atualizar página</button>
    </div></div>
  }
}

function VLibrasWidget() {
  useEffect(() => {
    const loadWidget = () => {
    if (document.getElementById('vlibras-script')) return
    const script = document.createElement('script')
    script.id = 'vlibras-script'
    script.async = true
    script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js'
    script.onload = () => {
      const vlibras = (window as unknown as { VLibras?: { Widget: new (url: string) => unknown } }).VLibras
      if (vlibras) new vlibras.Widget('https://vlibras.gov.br/app')
    }
    document.body.appendChild(script)
    }
    if (window.requestIdleCallback) {
      const idle = window.requestIdleCallback(loadWidget, { timeout: 3000 })
      return () => window.cancelIdleCallback(idle)
    }
    const timer = window.setTimeout(loadWidget, 1000)
    return () => window.clearTimeout(timer)
  }, [])

  // Marcação exigida pelo widget oficial do governo (atributos não-padrão, por isso o `as Record<string, string>`).
  return (
    <div {...({ vw: '', className: 'enabled' } as Record<string, string>)}>
      <div {...({ 'vw-access-button': '', className: 'active' } as Record<string, string>)} />
      <div {...({ 'vw-plugin-wrapper': '' } as Record<string, string>)}>
        <div className="vw-plugin-top-wrapper" />
      </div>
    </div>
  )
}

function SideMenu({ onClose, options, shortcuts, onOpenMoreOptions, onReorder, unseenNotifications, latestUpdateIsNew }: {
  onClose: () => void
  options: MoreOption[]
  shortcuts: MenuShortcutId[]
  onOpenMoreOptions: () => void
  onReorder: (ids: MenuShortcutId[]) => void
  unseenNotifications: number
  latestUpdateIsNew: boolean
}) {
  const [organizing, setOrganizing] = useState(false)
  const [draggedId, setDraggedId] = useState<MenuShortcutId | null>(null)
  const [dropTarget, setDropTarget] = useState<MenuShortcutId | null>(null)
  const [orderStatus, setOrderStatus] = useState('')

  function moveShortcut(id: MenuShortcutId, targetId: MenuShortcutId) {
    const from = shortcuts.indexOf(id)
    const to = shortcuts.indexOf(targetId)
    if (from < 0 || to < 0 || from === to) return
    const next = [...shortcuts]
    next.splice(from, 1)
    next.splice(to, 0, id)
    onReorder(next)
    setOrderStatus(`${options.find(item => item.id === id)?.title ?? 'Atalho'} na posição ${to + 1}. Ordem salva.`)
  }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="side-menu" role="dialog" aria-modal="true" aria-labelledby="menu-title">
        <div className="dialog-header">
          <h2 id="menu-title">Menu</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        {shortcuts.length > 1 && <div className="side-menu-organize">
          <button type="button" className="secondary-button" aria-pressed={organizing} onClick={() => { setOrganizing(!organizing); setDraggedId(null); setDropTarget(null) }}>
            {organizing ? <Check size={16} /> : <GripVertical size={16} />}{organizing ? 'Concluir organização' : 'Organizar atalhos'}
          </button>
          {organizing && <p>Arraste pela alça ou use as setas. A ordem é salva automaticamente.</p>}
        </div>}
        <span className="sr-only" role="status" aria-live="polite">{orderStatus}</span>
        <nav className="side-menu-list" aria-label="Atalhos principais">
          {shortcuts.map((id, index) => {
            const option = options.find(item => item.id === id)
            if (!option) return null
            const content = <><span className="side-menu-shortcut-icon" aria-hidden="true">{option.icon}</span><span>{option.title}</span>
              {id === 'notifications' && unseenNotifications > 0 && <span className="notif-count">{unseenNotifications}</span>}
              {id === 'updates' && latestUpdateIsNew && <span className="notif-count">Novo</span>}
              {option.href && <ExternalLink size={14} className="external-icon" aria-hidden="true" />}
            </>
            if (organizing) return <div key={id} className={`side-menu-sort-row${draggedId === id ? ' dragging' : ''}${dropTarget === id ? ' drop-target' : ''}`}
              onDragOver={event => { if (draggedId && draggedId !== id) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(id) } }}
              onDrop={event => { event.preventDefault(); if (draggedId) moveShortcut(draggedId, id); setDraggedId(null); setDropTarget(null) }}>
              <button type="button" className="side-menu-drag-handle" draggable aria-label={`Arrastar ${option.title}`} title="Arraste para mudar a posição"
                onDragStart={event => { event.dataTransfer.setData('text/plain', id); event.dataTransfer.effectAllowed = 'move'; setDraggedId(id) }}
                onDragEnd={() => { setDraggedId(null); setDropTarget(null) }}><GripVertical size={18} /></button>
              <span className="side-menu-sort-label">{content}</span>
              <div className="side-menu-sort-actions">
                <button type="button" aria-label={`Mover ${option.title} para cima`} disabled={index === 0} onClick={() => moveShortcut(id, shortcuts[index - 1])}><ArrowUp size={16} /></button>
                <button type="button" aria-label={`Mover ${option.title} para baixo`} disabled={index === shortcuts.length - 1} onClick={() => moveShortcut(id, shortcuts[index + 1])}><ArrowDown size={16} /></button>
              </div>
            </div>
            return option.href
              ? <a key={id} className="side-menu-external" href={option.href} target="_blank" rel="noopener noreferrer" onClick={onClose}>{content}</a>
              : <button type="button" key={id} onClick={option.onClick} disabled={option.disabled} title={option.disabled ? option.description : undefined}>{content}</button>
          })}
          {shortcuts.length === 0 && <p className="side-menu-empty">Escolha seus atalhos em “Ver mais opções”.</p>}
        </nav>
        <div className="side-menu-more">
          <p>Precisa de outra ferramenta?</p>
          <button type="button" className="side-menu-more-button" onClick={onOpenMoreOptions}>
            <span className="side-menu-more-icon"><LayoutGrid size={19} /></span>
            <span className="side-menu-more-copy"><strong>Ver mais opções</strong><small>Todos os recursos, por categoria</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </aside>
    </div>
  )
}

type MoreOption = {
  id: MenuShortcutId
  title: string
  description: string
  icon: ReactNode
  onClick?: () => void
  href?: string
  disabled?: boolean
}

type MoreOptionSection = { title: string; description: string; items: MoreOption[] }

function menuOptionSections({ turmaId, onOpenNotifications, onOpenUpdates, onOpenPolls, onOpenNotices, onSuggestActivity, onRequestClass, onOpenFeedback, onOpenMySuggestions, onOpenAdmin, onOpenConfig, onOpenProfiles, onOpenDocs }: {
  turmaId: string | null
  onOpenNotifications: () => void
  onOpenUpdates: () => void
  onOpenPolls: () => void
  onOpenNotices: () => void
  onSuggestActivity: () => void
  onRequestClass: () => void
  onOpenFeedback: () => void
  onOpenMySuggestions: () => void
  onOpenAdmin: () => void
  onOpenConfig: () => void
  onOpenProfiles: () => void
  onOpenDocs: () => void
}): MoreOptionSection[] {
  const needsTurma = !turmaId
  return [
    {
      title: 'Acompanhar a turma',
      description: 'Avisos e atividades da turma selecionada.',
      items: [
        { id: 'notifications', title: 'Notificações', description: 'Veja atividades adicionadas ou alteradas recentemente.', icon: <Bell />, onClick: onOpenNotifications },
        { id: 'updates', title: 'Atualizações', description: 'Confira o que mudou no sistema da Agenda.', icon: <History />, onClick: onOpenUpdates },
        { id: 'polls', title: 'Enquetes da turma', description: needsTurma ? 'Escolha uma turma para ver e responder enquetes.' : 'Acompanhe votações e participe das decisões.', icon: <Vote />, onClick: onOpenPolls, disabled: needsTurma },
        { id: 'notices', title: 'Quadro de avisos', description: needsTurma ? 'Escolha uma turma para abrir os avisos.' : 'Consulte comunicados importantes da turma.', icon: <StickyNote />, onClick: onOpenNotices, disabled: needsTurma },
        { id: 'suggestActivity', title: 'Sugerir atividade', description: needsTurma ? 'Escolha uma turma antes de enviar uma sugestão.' : 'Peça para incluir uma atividade na agenda.', icon: <Lightbulb />, onClick: onSuggestActivity, disabled: needsTurma },
        { id: 'todayClasses', title: 'Aulas de hoje', description: needsTurma ? 'Escolha uma turma para consultar as aulas.' : 'Abra a localização das aulas de hoje.', icon: <CalendarClock />, href: turmaId ? teacherFinderTodayUrl(turmaId) : undefined, disabled: needsTurma },
      ],
    },
    {
      title: 'Participar e colaborar',
      description: 'Ajude a melhorar e ampliar a Agenda.',
      items: [
        { id: 'requestClass', title: 'Pedir agenda para minha turma', description: 'Solicite a criação de uma agenda para outra sala.', icon: <Plus />, onClick: onRequestClass },
        { id: 'feedback', title: 'Comentar melhoria', description: 'Converse com a equipe sobre uma ideia para o sistema.', icon: <MessageSquarePlus />, onClick: onOpenFeedback },
        { id: 'mySuggestions', title: 'Minhas sugestões', description: 'Acompanhe o andamento das ideias que você enviou.', icon: <ListChecks />, onClick: onOpenMySuggestions },
        { id: 'admin', title: 'Sou representante', description: 'Acesse as ferramentas para representantes de turma.', icon: <KeyRound />, onClick: onOpenAdmin },
      ],
    },
    {
      title: 'Conta e ajuda',
      description: 'Personalize sua experiência e encontre orientações.',
      items: [
        { id: 'settings', title: 'Configurações', description: 'Ajuste tema, tamanho do texto e acessibilidade.', icon: <Settings />, onClick: onOpenConfig },
        { id: 'profiles', title: 'Perfis da comunidade', description: 'Edite seu perfil e conheça outras pessoas.', icon: <UserRound />, onClick: onOpenProfiles },
        { id: 'help', title: 'Como funciona', description: 'Entenda os recursos e como usar a Agenda.', icon: <BookOpen />, onClick: onOpenDocs },
      ],
    },
    {
      title: 'Outros projetos',
      description: 'Acesse outras ferramentas da comunidade 2ºD Tech.',
      items: [
        { id: 'teachers', title: 'Cadê o professor?', description: 'Pesquise professores, matérias e salas.', icon: <MapPin />, href: 'https://tech-2d.github.io/professores/' },
        { id: 'pong', title: 'Liga Germinare Pong', description: 'Acesse a liga de tênis de mesa.', icon: <TableTennisPaddle />, href: 'https://ligagerminare-pong.vercel.app/' },
      ],
    },
  ]

}

function MoreOptionsPage({ turmaId, onBack, sections, shortcuts, onToggleShortcut, onResetShortcuts }: {
  turmaId: string | null
  onBack: () => void
  sections: MoreOptionSection[]
  shortcuts: MenuShortcutId[]
  onToggleShortcut: (id: MenuShortcutId) => void
  onResetShortcuts: () => void
}) {
  return (
    <main className="more-options-page" id="mais-opcoes">
      <button type="button" className="more-options-back" onClick={onBack}><ChevronLeft size={18} /> Voltar para a agenda</button>
      <header className="more-options-heading">
        <div>
          <span className="more-options-eyebrow">AGENDA DA TURMA</span>
          <h1>Mais opções</h1>
          <p>Encontre cada ferramenta por assunto, sem deixar o menu principal carregado.</p>
        </div>
        <span className="more-options-turma">{turmaId ?? 'Nenhuma turma selecionada'}</span>
      </header>
      <section className="menu-customize-note" aria-labelledby="customize-menu-title">
        <div><h2 id="customize-menu-title">Seu menu lateral</h2>
          <p>Marque nos cartões os atalhos que quer no menu. A escolha é salva automaticamente neste navegador. “Ver mais opções” fica sempre disponível.</p>
          <span role="status" aria-live="polite">{shortcuts.length} {shortcuts.length === 1 ? 'atalho selecionado' : 'atalhos selecionados'}</span>
        </div>
        <button type="button" className="secondary-button" onClick={onResetShortcuts}>Restaurar padrão</button>
      </section>
      <div className="more-options-sections">
        {sections.map((section, sectionIndex) => (
          <section className="more-options-section" key={section.title} aria-labelledby={`options-${sectionIndex}`}>
            <div className="more-options-section-heading">
              <h2 id={`options-${sectionIndex}`}>{section.title}</h2>
              <p>{section.description}</p>
            </div>
            <div className="more-options-grid">
              {section.items.map(option => <div className={`more-option-item${shortcuts.includes(option.id) ? ' pinned' : ''}`} key={option.id}>
                <MoreOptionCard {...option} />
                <label className="more-option-pin">
                  <input type="checkbox" checked={shortcuts.includes(option.id)} onChange={() => onToggleShortcut(option.id)} aria-label={`Mostrar ${option.title} no menu lateral`} />
                  <span>{shortcuts.includes(option.id) ? 'No menu lateral' : 'Adicionar ao menu lateral'}</span>
                </label>
              </div>)}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}

function MoreOptionCard({ title, description, icon, onClick, href, disabled }: MoreOption) {
  const content = (
    <>
      <span className="more-option-icon" aria-hidden="true">{icon}</span>
      <span className="more-option-copy"><strong>{title}</strong><small>{description}</small></span>
      {href ? <ExternalLink size={16} className="more-option-end" aria-hidden="true" /> : <ChevronRight size={17} className="more-option-end" aria-hidden="true" />}
    </>
  )

  if (href) return <a className="more-option-card" href={href} target="_blank" rel="noopener noreferrer">{content}</a>
  return <button type="button" className="more-option-card" onClick={onClick} disabled={disabled}>{content}</button>
}

function TableTennisPaddle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
      <path d="m13.3 14.2 6.2 7" strokeWidth="3.2" />
      <ellipse cx="9.2" cy="9.1" rx="5.7" ry="7" transform="rotate(-38 9.2 9.1)" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="2.2" strokeWidth="1.8" />
    </svg>
  )
}

function ConfigDialog({
  theme,
  neon,
  onSetTheme,
  onSetNeon,
  fontScale,
  onSetFontScale,
  highContrast,
  onSetHighContrast,
  reduceMotion,
  onSetReduceMotion,
  onClose,
}: {
  theme: Theme
  neon: NeonColor
  onSetTheme: (value: Theme) => void
  onSetNeon: (value: NeonColor) => void
  fontScale: FontScale
  onSetFontScale: (value: FontScale) => void
  highContrast: boolean
  onSetHighContrast: (value: boolean) => void
  reduceMotion: boolean
  onSetReduceMotion: (value: boolean) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="config-dialog" role="dialog" aria-modal="true" aria-labelledby="config-title">
        <div className="dialog-header">
          <h2 id="config-title">Configurações</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        <div className="config-content">
          <WeeklyDigestSettings />
          <div className="config-section">
            <h3>Tema</h3>
            <div className="theme-options">
              {THEMES.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`theme-swatch ${theme === value ? 'active' : ''}`}
                  aria-pressed={theme === value}
                  onClick={() => onSetTheme(value)}
                >
                  <span className="theme-dot" style={{ background: THEME_PREVIEW[value] }} />
                  {THEME_LABELS[value]}
                </button>
              ))}
            </div>
            {theme === 'cyberpunk' && (
              <div className="neon-options" aria-label="Cor de destaque neon">
                {NEON_COLORS.map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={`neon-swatch ${neon === value ? 'active' : ''}`}
                    style={{ background: NEON_COLOR_SWATCHES[value] }}
                    onClick={() => onSetNeon(value)}
                    aria-label={NEON_COLOR_LABELS[value]}
                    title={NEON_COLOR_LABELS[value]}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="config-section">
            <h3>Acessibilidade</h3>
            <p className="config-hint">Tamanho da fonte</p>
            <div className="theme-options">
              {FONT_SCALES.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`theme-swatch ${fontScale === value ? 'active' : ''}`}
                  onClick={() => onSetFontScale(value)}
                >
                  {FONT_SCALE_LABELS[value]}
                </button>
              ))}
            </div>
            <label className="a11y-toggle">
              <span>Alto contraste</span>
              <span className="toggle"><input type="checkbox" checked={highContrast} onChange={(event) => onSetHighContrast(event.target.checked)} /><span /></span>
            </label>
            <label className="a11y-toggle">
              <span>Reduzir animações</span>
              <span className="toggle"><input type="checkbox" checked={reduceMotion} onChange={(event) => onSetReduceMotion(event.target.checked)} /><span /></span>
            </label>
            <p className="config-hint">VLibras (tradutor de Libras) já está disponível no botão flutuante no canto da tela.</p>
          </div>
          <div className="config-section muted">
            <h3>Apoie o projeto</h3>
            <p>Em breve: chave Pix para quem quiser pagar um café.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

function DocsDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-dialog docs-dialog" role="dialog" aria-modal="true" aria-labelledby="docs-title">
        <div className="dialog-header">
          <div><p className="eyebrow dark">AJUDA</p><h2 id="docs-title">Como funciona a Agenda</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        <div className="config-content">
          <div className="config-section">
            <h3>O que é</h3>
            <p>Um calendário mensal com as tarefas, lições, trabalhos e eventos da sua turma. A leitura é pública — não precisa de login para consultar.</p>
          </div>

          <div className="config-section">
            <h3>Tipos de atividade</h3>
            <div className="docs-type-legend">
              {ACTIVITY_TYPES.map((type) => (
                <span key={type} className="docs-type-item">
                  <span className="chip-dot" style={{ background: ACTIVITY_TYPE_COLORS[type] }} />
                  {ACTIVITY_TYPE_LABELS[type]}
                </span>
              ))}
            </div>
          </div>

          <div className="config-section">
            <h3>Matéria</h3>
            <p>Cada atividade pode ter uma matéria associada (opcional). Use o filtro "Todas as matérias" ao lado do seletor de turma para ver só a matéria que te interessa.</p>
          </div>

          <div className="config-section">
            <h3>Sua turma</h3>
            <p>Na primeira visita, você escolhe sua turma e o navegador lembra essa escolha. Dá pra trocar quando quiser pelo seletor no topo da página — outras turmas continuam acessíveis, só a sua fica salva como padrão.</p>
          </div>

          <div className="config-section">
            <h3>Sugerir uma atividade</h3>
            <p>Qualquer aluno pode sugerir uma atividade pelo botão "Sugerir atividade", sem precisar de login. O representante da turma avalia: se aprovar, a atividade já entra na agenda automaticamente. Você acompanha o status (pendente/aprovada/rejeitada) em "Minhas sugestões", no menu.</p>
          </div>

          <div className="config-section">
            <h3>Área administrativa</h3>
            <p>Cada turma tem um ou mais representantes, que fazem login para criar, editar e excluir atividades e avaliar sugestões. Um representante só gerencia a própria turma; o super-admin gerencia todas e também lê os comentários enviados em "Comentar melhoria". O card de cada atividade mostra o e-mail de quem publicou, pra facilitar contato.</p>
          </div>

          <div className="config-section">
            <h3>Eventos gerais</h3>
            <p>Além das atividades de cada turma, qualquer representante (ou o super-admin) pode criar um <strong>evento geral</strong> — aparece com o selo "Geral" no calendário de todas as turmas ao mesmo tempo. Só quem criou (ou o super-admin) pode editar ou excluir depois.</p>
          </div>

          <div className="config-section">
            <h3>Personalização</h3>
            <p>Em Configurações (menu) dá pra trocar o tema (Padrão, Escuro ou Cyberpunk com cor neon à sua escolha), ajustar tamanho da fonte, ativar alto contraste e reduzir animações. O site também conta com o VLibras (tradutor de Libras), sempre disponível no canto da tela.</p>
          </div>

          <div className="config-section">
            <h3>Seus dados</h3>
            <p>Alunos não criam conta. O navegador guarda localmente (no seu próprio aparelho) só a turma escolhida, o tema, as preferências de acessibilidade e os IDs das sugestões que você enviou — nada disso é compartilhado com outras pessoas nem sai do seu navegador.</p>
          </div>

          <div className="config-section muted">
            <h3>Encontrou um problema?</h3>
            <p>Manda pra gente em "Comentar melhoria", no menu.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

function TurmaPickerModal({ classNames, onChoose, onRequest }: { classNames: string[]; onChoose: (turmaId: string) => void; onRequest: () => void }) {
  const [search, setSearch] = useState('')
  const options = classNames.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase()))
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="turma-picker" role="dialog" aria-modal="true" aria-labelledby="turma-picker-title">
        <div className="login-symbol"><Calendar /></div>
        <h3 id="turma-picker-title">Qual é a sua turma?</h3>
        <p>O app vai lembrar essa escolha no seu navegador. Você pode trocar de turma quando quiser pelo seletor no topo da página.</p>
        <input
          aria-label="Buscar turma"
          placeholder="Buscar turma"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          autoFocus
        />
        <div className="turma-options">
          {options.length === 0 ? <p className="admin-empty">Nenhuma turma encontrada.</p> : options.map((name) => (
            <button type="button" key={name} onClick={() => onChoose(name)}>{name}</button>
          ))}
        </div>
        <button type="button" className="access-switch" onClick={onRequest}>Minha turma não aparece? Solicite uma agenda</button>
      </section>
    </div>
  )
}

function SuggestDialog({ turmaId, onClose }: { turmaId: string; onClose: () => void }) {
  const [form, setForm] = useState(emptyForm)
  const [hasTime, setHasTime] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload: SuggestionInput = { ...form, subject: form.subject ?? null, time: hasTime ? form.time : null, turmaId }
      const reference = await addDoc(collection(db, 'suggestions'), { ...payload, status: 'pendente', createdAt: serverTimestamp() })
      addMySuggestionId(reference.id)
      setSent(true)
    } catch {
      setError('Não foi possível enviar a sugestão. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="day-dialog" role="dialog" aria-modal="true" aria-labelledby="suggest-title">
        <div className="dialog-header">
          <div><p className="eyebrow dark">TURMA {turmaId}</p><h2 id="suggest-title">Sugerir atividade</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        {sent ? (
          <div className="state-card"><Check /><p>Sugestão enviada! O representante da turma vai avaliar. Acompanhe em "Minhas sugestões" no menu.</p></div>
        ) : (
          <form className="activity-form standalone" onSubmit={submit}>
            <div className="form-grid">
              <label className="wide">Título<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
              <label>Tipo<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as ActivityType })}>{ACTIVITY_TYPES.map((type) => <option value={type} key={type}>{ACTIVITY_TYPE_LABELS[type]}</option>)}</select></label>
              <label className="wide">Matéria<select value={form.subject ?? ''} onChange={(event) => setForm({ ...form, subject: event.target.value || null })}><option value="">Sem matéria específica</option>{SUBJECTS.map((subject) => <option value={subject} key={subject}>{subject}</option>)}</select></label>
              <label>Data<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
              <label className="toggle wide"><input type="checkbox" checked={hasTime} onChange={(event) => { setHasTime(event.target.checked); if (!event.target.checked) setForm({ ...form, time: null }) }} /><span /> Tem horário definido</label>
              {hasTime && <label>Horário<input required type="time" value={form.time ?? ''} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label>}
              <label className="wide">Descrição<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Detalhes, capítulos, critérios de entrega…" /></label>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button compact" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : 'Enviar sugestão'}</button></div>
          </form>
        )}
      </section>
    </div>
  )
}

function MySuggestionsDialog({ onClose }: { onClose: () => void }) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    const ids = readMySuggestionIds()
    if (ids.length === 0) {
      setSuggestions([])
      return
    }
    Promise.all(ids.map((id) => getDoc(doc(db, 'suggestions', id)))).then((snapshots) => {
      if (cancelled) return
      const found: Suggestion[] = []
      snapshots.forEach((snapshot, index) => {
        if (snapshot.exists()) found.push({ id: snapshot.id, ...snapshot.data() } as Suggestion)
        else removeMySuggestionId(ids[index])
      })
      setSuggestions(found)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="day-dialog" role="dialog" aria-modal="true" aria-labelledby="my-suggestions-title">
        <div className="dialog-header">
          <h2 id="my-suggestions-title">Minhas sugestões</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        <div className="day-dialog-list">
          {suggestions === null ? (
            <div className="state-card"><LoaderCircle className="spin" /><p>Carregando…</p></div>
          ) : suggestions.length === 0 ? (
            <p className="admin-empty">Você ainda não enviou nenhuma sugestão neste navegador.</p>
          ) : suggestions.map((item) => (
            <article key={item.id} className="activity-detail" style={{ borderLeftColor: ACTIVITY_TYPE_COLORS[item.type] }}>
              <div className="activity-detail-heading">
                <span className="type-badge" style={{ background: ACTIVITY_TYPE_COLORS[item.type] }}>{ACTIVITY_TYPE_LABELS[item.type]}</span>
                <span className={`status-badge status-${item.status}`}>{SUGGESTION_STATUS_LABELS[item.status]}</span>
              </div>
              <h3>{item.title}</h3>
              {item.description && <p>{item.description}</p>}
              {item.resolution && item.reviewComment && (
                <div className="suggestion-response">
                  <strong>Resposta da administração · {item.resolution === 'feito' ? 'Foi feito' : 'Não foi feito'}</strong>
                  <p>{item.reviewComment}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function FeedbackDialog({ turmaId, onClose }: { turmaId: string | null; onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [publicCreditName, setPublicCreditName] = useState('')
  const [publicCreditAllowed, setPublicCreditAllowed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [account, setAccount] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authNotice, setAuthNotice] = useState('')

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setAccount(currentUser)
    setAuthChecked(true)
  }), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function authenticate(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setAuthNotice('')
    try {
      if (authMode === 'register') {
        await createUserWithEmailAndPassword(auth, email.trim(), password)
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      }
      setPassword('')
    } catch (cause) {
      if (cause instanceof FirebaseError && cause.code === 'auth/email-already-in-use') {
        setError('Este e-mail já tem conta. Entre com sua senha ou recupere o acesso.')
      } else if (cause instanceof FirebaseError && cause.code === 'auth/weak-password') {
        setError('Escolha uma senha com pelo menos 6 caracteres.')
      } else if (cause instanceof FirebaseError && cause.code === 'auth/network-request-failed') {
        setError('Sem conexão com o Firebase. Tente novamente.')
      } else {
        setError('Não foi possível entrar. Confira o e-mail e a senha.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function recoverPassword() {
    if (!email.trim()) {
      setError('Informe seu e-mail para recuperar a senha.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await requestPasswordReset(email.trim())
      setAuthNotice('Se o e-mail tiver uma conta, você receberá um link para redefinir a senha. Confira também a pasta de spam ou lixo eletrônico.')
    } catch {
      setError('Não foi possível enviar o link agora. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const currentUser = auth.currentUser
    if (!currentUser?.email) {
      setError('Entre com sua conta para enviar o comentário.')
      return
    }
    if (publicCreditAllowed && (!publicCreditName.trim() || publicCreditName.includes('@'))) {
      setError('Escolha um nome público sem e-mail para autorizar o crédito.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await addDoc(collection(db, 'feedback'), {
        message: message.trim(), turmaId: turmaId ?? null,
        createdBy: currentUser.uid, createdByEmail: currentUser.email,
        publicCreditName: publicCreditAllowed ? publicCreditName.trim() : '', publicCreditAllowed,
        createdAt: serverTimestamp(),
      })
      setSent(true)
    } catch {
      setError('Não foi possível enviar o comentário. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="day-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <div className="dialog-header">
          <h2 id="feedback-title">Melhorias e conversas</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        {account && <MyFeedbackConversations userId={account.uid} />}
        {!authChecked ? (
          <div className="feedback-auth-loading"><LoaderCircle className="spin" /><p>Verificando sua conta…</p></div>
        ) : sent ? (
          <div className="state-card"><Check /><p>Obrigado! Seu comentário foi enviado.</p></div>
        ) : !account ? (
          <form className="feedback-auth" onSubmit={authenticate}>
            <p>Entre para enviar sua ideia. Seu e-mail ficará visível apenas para a administração.</p>
            <label htmlFor="feedback-email">E-mail</label>
            <input id="feedback-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required autoFocus />
            <label htmlFor="feedback-password">Senha</label>
            <input id="feedback-password" type="password" minLength={authMode === 'register' ? 6 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} required />
            {error && <p className="form-error" role="alert">{error}</p>}
            {authNotice && <p className="access-notice" role="status">{authNotice}</p>}
            <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : authMode === 'register' ? 'Criar conta' : 'Entrar'}</button>
            <div className="feedback-auth-links">
              <button type="button" className="access-switch" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError(''); setAuthNotice('') }} disabled={busy}>
                {authMode === 'login' ? 'Criar uma conta' : 'Já tenho conta'}
              </button>
              {authMode === 'login' && <button type="button" className="access-switch" onClick={recoverPassword} disabled={busy}>Esqueci minha senha</button>}
            </div>
          </form>
        ) : (
          <form className="activity-form standalone" onSubmit={submit}>
            <div className="feedback-account"><span>Enviando como <strong>{account.email}</strong></span><button type="button" className="access-switch" onClick={() => signOut(auth)}>Trocar conta</button></div>
            <div className="form-grid">
              <label className="wide">
                O que podemos melhorar no site?
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Sugestões, problemas que encontrou, ideias..."
                  autoFocus
                />
              </label>
              <div className="feedback-public-credit wide">
                <label><input type="checkbox" checked={publicCreditAllowed} onChange={(event) => setPublicCreditAllowed(event.target.checked)} /> Autorizo mostrar meu nome e esta sugestão em um aviso público de atualização.</label>
                {publicCreditAllowed && <label>Nome para o crédito público<input value={publicCreditName} onChange={(event) => setPublicCreditName(event.target.value)} maxLength={60} required placeholder="Como você quer aparecer?" /></label>}
                <small>Seu e-mail não será publicado. Você também pode decidir isso depois, em suas conversas.</small>
              </div>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button compact" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : 'Enviar comentário'}</button></div>
          </form>
        )}
      </section>
    </div>
  )
}

function AnnouncementModal({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="day-dialog" role="dialog" aria-modal="true" aria-labelledby="announcement-title">
        <div className="dialog-header">
          <div><p className="eyebrow dark">NOVIDADE</p><h2 id="announcement-title">O que mudou</h2></div>
        </div>
        <div className="announcement-body">
          <p>{message}</p>
          <button className="primary-button" onClick={onClose}>Entendi</button>
        </div>
      </section>
    </div>
  )
}

function SystemUpdateWelcome({ update, onClose }: { update: SystemUpdate; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop system-update-backdrop" role="presentation">
      <section className="system-update-dialog" role="dialog" aria-modal="true" aria-labelledby="system-update-title">
        <div className="system-update-accent"><History size={22} aria-hidden="true" /><span>Atualização da Agenda</span></div>
        <div className="system-update-content">
          <p className="eyebrow">O QUE MUDOU</p>
          <h2 id="system-update-title">{update.title}</h2>
          {update.publishedAt && <time>{update.publishedAt.toDate().toLocaleDateString('pt-BR')}</time>}
          <p>{update.body}</p>
          {update.sourceName && update.sourceMessage && <div className="update-request-credit"><strong>Pedido da comunidade · {update.sourceName}</strong><p>{update.sourceMessage}</p></div>}
          <button type="button" className="primary-button" onClick={onClose} autoFocus>Entendi, abrir agenda</button>
          <span>Você pode reler esta novidade em Atualizações, no menu.</span>
        </div>
      </section>
    </div>
  )
}

function SystemUpdatesDialog({ onClose }: { onClose: () => void }) {
  const [updates, setUpdates] = useState<SystemUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => observeCatalog<{ updates: SystemUpdate[] }>('updates', data => {
    setUpdates(data.updates)
    setLoading(false)
    setError('')
  }, () => {
    setLoading(false)
    setError('Não foi possível carregar as atualizações. Tente novamente mais tarde.')
  }), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="updates-history-dialog" role="dialog" aria-modal="true" aria-labelledby="updates-history-title">
        <div className="dialog-header">
          <div><p className="eyebrow">HISTÓRICO</p><h2 id="updates-history-title">Atualizações</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        <div className="updates-history-list">
          {loading ? <p className="polls-note"><LoaderCircle className="spin" size={15} /> Carregando atualizações…</p>
            : error ? <p className="form-error" role="alert">{error}</p>
            : updates.length === 0 ? <p className="admin-empty">Ainda não há atualizações publicadas.</p>
              : updates.map((item, index) => <article key={item.id} className="updates-history-item">
                <div className="updates-history-meta"><span>{index === 0 ? 'Mais recente' : 'Atualização'}</span>{item.publishedAt && <time>{item.publishedAt.toDate().toLocaleDateString('pt-BR')}</time>}</div>
                <h3>{item.title}</h3><p>{item.body}</p>
                {item.sourceName && item.sourceMessage && <div className="update-request-credit"><strong>Pedido da comunidade · {item.sourceName}</strong><p>{item.sourceMessage}</p></div>}
              </article>)}
        </div>
      </section>
    </div>
  )
}

function NotificationsDialog({ activities, onClose }: { activities: Activity[]; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="day-dialog" role="dialog" aria-modal="true" aria-labelledby="notifications-title">
        <div className="dialog-header">
          <div><p className="eyebrow dark">ÚLTIMOS 14 DIAS</p><h2 id="notifications-title">Notificações</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        <div className="day-dialog-list">
          {activities.length === 0 ? (
            <p className="admin-empty">Nenhuma novidade na agenda nos últimos 14 dias.</p>
          ) : activities.map((activity) => {
            const isNew = createdAtMs(activity) === updatedAtMs(activity)
            const changedAt = activity.updatedAt?.toDate()
            return (
              <article key={activity.id} className="activity-detail" style={{ borderLeftColor: ACTIVITY_TYPE_COLORS[activity.type] }}>
                <div className="activity-detail-heading">
                  <span className="type-badge" style={{ background: ACTIVITY_TYPE_COLORS[activity.type] }}>{ACTIVITY_TYPE_LABELS[activity.type]}</span>
                  {activity.turmaId === null && <span className="type-badge general-badge">Geral</span>}
                  <span className={`status-badge ${isNew ? 'status-nova' : 'status-atualizada'}`}>{isNew ? 'Nova' : 'Atualizada'}</span>
                </div>
                <h3>{activity.title}</h3>
                {activity.subject && <p className="activity-subject">{activity.subject}</p>}
                <p>{parseDateLabel(activity.date)}{activity.time ? ` · ${activity.time}` : ''}{changedAt ? ` — alterado em ${changedAt.toLocaleDateString('pt-BR')}` : ''}</p>
                {activity.createdByEmail && <p className="activity-author">Publicado por {activity.createdByEmail}</p>}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function DayDetail({ day, activities, profile, canAdd, onEditActivity, onAddActivity, onClose }: { day: Date; activities: Activity[]; profile: AdminProfile | null; canAdd: boolean; onEditActivity: (activity: Activity) => void; onAddActivity: () => void; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="day-dialog" role="dialog" aria-modal="true" aria-labelledby="day-title">
        <div className="dialog-header">
          <h2 id="day-title">{day.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        {canAdd && <div className="day-create-bar">
          <span>Cadastro para representantes</span>
          <button type="button" className="secondary-button" onClick={onAddActivity}><Plus size={17} /> Cadastrar atividade</button>
        </div>}
        <div className="day-dialog-list">
          {activities.length === 0 && <p className="day-empty">Ainda não há atividades para esta data.</p>}
          {activities.map((activity) => (
            <article key={activity.id} className="activity-detail" style={{ borderLeftColor: ACTIVITY_TYPE_COLORS[activity.type] }}>
              <div className="activity-detail-heading">
                <span className="type-badge" style={{ background: ACTIVITY_TYPE_COLORS[activity.type] }}>{ACTIVITY_TYPE_LABELS[activity.type]}</span>
                {activity.turmaId === null && <span className="type-badge general-badge">Geral</span>}
                {activity.time && <span className="activity-time">{activity.time}</span>}
              </div>
              <h3>{activity.title}</h3>
              {activity.subject && <p className="activity-subject">{activity.subject}</p>}
              {activity.description && <p>{activity.description}</p>}
              {ATTACHMENTS_ENABLED && <AttachmentLinks activityId={activity.id} attachments={activity.attachments} />}
              {activity.createdByEmail && <p className="activity-author">Publicado por {activity.createdByEmail}</p>}
              {canEditCalendarActivity(profile, activity) && <button type="button" className="secondary-button" onClick={() => onEditActivity(activity)} aria-label={`Editar ${activity.title}`}><Edit3 size={16} /> Editar atividade</button>}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function parseDateLabel(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default App
