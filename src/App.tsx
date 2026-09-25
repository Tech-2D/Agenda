import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  Bell,
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Edit3,
  ExternalLink,
  KeyRound,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  MessageSquarePlus,
  Plus,
  Settings,
  Trash2,
  UserRound,
  Vote,
  X,
} from 'lucide-react'
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { CLASS_NAMES } from './classNames'
import { SUBJECTS } from './subjects'
import {
  MONTH_LABELS,
  WEEKDAY_LABELS,
  addMonths,
  compareActivities,
  dateKey,
  getMonthMatrix,
  isToday,
  matchesSearch,
} from './calendar'
import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_COLORS,
  ACTIVITY_TYPE_LABELS,
  SUGGESTION_STATUS_LABELS,
  type Activity,
  type ActivityInput,
  type ActivityType,
  type AdminProfile,
  type Announcement,
  type Feedback,
  type Suggestion,
  type SuggestionInput,
  type SuggestionResolution,
} from './types'
import { addMySuggestionId, readMySuggestionIds, removeMySuggestionId } from './mySuggestions'
import { markNotificationsSeenNow, readLastSeen } from './notifications'
import { markAnnouncementSeen, readAnnouncementSeenAt } from './announcementSeen'
import { isValidRepresentativeEmail, normalizeRepresentativeEmail, readRepresentativeRequestId, storeRepresentativeRequestId, type RepresentativeRequest } from './representativeAccess'
import { canCreateForSelectedClass } from './quickCreate'
import { PollsDialog } from './PollsDialog'
import {
  NEON_COLORS,
  NEON_COLOR_LABELS,
  NEON_COLOR_SWATCHES,
  THEME_LABELS,
  THEME_PREVIEW,
  THEMES,
  readStoredNeon,
  readStoredTheme,
  storeNeon,
  storeTheme,
  type NeonColor,
  type Theme,
} from './theme'
import {
  FONT_SCALES,
  FONT_SCALE_LABELS,
  readStoredFontScale,
  readStoredHighContrast,
  readStoredReduceMotion,
  storeFontScale,
  storeHighContrast,
  storeReduceMotion,
  type FontScale,
} from './accessibility'

const TURMA_STORAGE_KEY = 'agenda:turma'
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

function readStoredTurma(): string | null {
  try {
    const value = window.localStorage.getItem(TURMA_STORAGE_KEY)
    return value && (CLASS_NAMES as readonly string[]).includes(value) ? value : null
  } catch {
    return null
  }
}

async function loadOrClaimAdminProfile(account: User): Promise<AdminProfile | null> {
  const adminRecord = await getDoc(doc(db, 'admins', account.uid))
  const profile = adminRecord.data() as AdminProfile | undefined
  if (profile?.role === 'representante' || profile?.role === 'superadmin') return profile
  if (adminRecord.exists() || !account.email) return null

  const email = normalizeRepresentativeEmail(account.email)
  const invite = await getDoc(doc(db, 'representativeInvites', email))
  const turmaId = invite.data()?.turmaId
  if (!invite.exists() || invite.data()?.email !== email || !(CLASS_NAMES as readonly string[]).includes(turmaId)) return null

  await setDoc(doc(db, 'admins', account.uid), { role: 'representante', turmaId, createdAt: serverTimestamp() })
  return { role: 'representante', turmaId }
}

function App() {
  const [turmaId, setTurmaId] = useState<string | null>(readStoredTurma)
  const [subjectFilter, setSubjectFilter] = useState('')
  const [turmaActivities, setTurmaActivities] = useState<Activity[]>([])
  const [globalActivities, setGlobalActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [monthCursor, setMonthCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [dayPreview, setDayPreview] = useState<{ key: string; day: Date; activities: Activity[]; left: number; top: number; width: number } | null>(null)
  const previewCloseTimer = useRef<number | null>(null)
  const [adminOpen, setAdminOpen] = useState(['#admin', '#representante'].includes(window.location.hash))
  const [quickCreateDate, setQuickCreateDate] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [mySuggestionsOpen, setMySuggestionsOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [pollsOpen, setPollsOpen] = useState(false)
  const [docsOpen, setDocsOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsSeenAt, setNotificationsSeenAt] = useState(0)
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [announcementSeenAt, setAnnouncementSeenAt] = useState(readAnnouncementSeenAt)
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const [neon, setNeonState] = useState<NeonColor>(readStoredNeon)
  const [fontScale, setFontScaleState] = useState<FontScale>(readStoredFontScale)
  const [highContrast, setHighContrastState] = useState(readStoredHighContrast)
  const [reduceMotion, setReduceMotionState] = useState(readStoredReduceMotion)

  function setTheme(value: Theme) {
    setThemeState(value)
    storeTheme(value)
  }

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

  useEffect(() => {
    return onSnapshot(doc(db, 'announcement', 'latest'), (snapshot) => {
      setAnnouncement(snapshot.exists() ? (snapshot.data() as Announcement) : null)
    }, () => setAnnouncement(null))
  }, [])

  const announcementUpdatedMs = announcement?.updatedAt?.toDate().getTime() ?? 0
  const showAnnouncement = Boolean(turmaId) && announcementUpdatedMs > 0 && announcementUpdatedMs > announcementSeenAt

  function chooseTurma(value: string) {
    setTurmaId(value)
    try {
      window.localStorage.setItem(TURMA_STORAGE_KEY, value)
    } catch {
      // localStorage indisponível (modo privado etc.) — a escolha só vale para esta sessão.
    }
  }

  useEffect(() => {
    if (!turmaId) {
      setTurmaActivities([])
      setLoading(false)
      return
    }
    setLoading(true)
    const activitiesQuery = query(collection(db, 'activities'), where('turmaId', '==', turmaId))
    return onSnapshot(
      activitiesQuery,
      (snapshot) => {
        setTurmaActivities(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Activity))
        setLoading(false)
        setLoadError('')
      },
      () => {
        setLoading(false)
        setLoadError('Não foi possível carregar a agenda. Confira a conexão e as regras do Firestore.')
      },
    )
  }, [turmaId])

  useEffect(() => {
    const globalQuery = query(collection(db, 'activities'), where('turmaId', '==', null))
    return onSnapshot(globalQuery, (snapshot) => {
      setGlobalActivities(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Activity))
    }, () => setGlobalActivities([]))
  }, [])

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

  const openAdminForDay = (day: Date) => {
    setQuickCreateDate(dateKey(day))
    openAdmin()
  }

  const closeAdmin = () => {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    setAdminOpen(false)
    setQuickCreateDate(null)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          type="button"
          className="admin-trigger"
          aria-label="Abrir área administrativa"
          aria-haspopup="dialog"
          title="Área administrativa"
          onClick={openAdmin}
        >
          <KeyRound size={20} strokeWidth={2.3} aria-hidden="true" />
        </button>
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

      <main id="inicio" className="main-content">
        <div className="agenda-toolbar">
          <div className="agenda-heading">
            <h1>Sua agenda</h1>
            <label className="turma-select-inline" aria-label="Turma selecionada">
              <select value={turmaId ?? ''} onChange={(event) => chooseTurma(event.target.value)}>
                <option value="" disabled>Selecione uma turma</option>
                {CLASS_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
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
            {turmaId && (
              <button type="button" className="secondary-button" onClick={() => setPollsOpen(true)}>
                <Vote size={16} /> Enquetes da turma
              </button>
            )}
            {turmaId && (
              <button type="button" className="secondary-button" onClick={() => setSuggestOpen(true)}>
                <Lightbulb size={16} /> Sugerir atividade
              </button>
            )}
          </div>

          <div className="month-nav">
            <button type="button" onClick={() => setMonthCursor((current) => addMonths(current, -1))} aria-label="Mês anterior"><ChevronLeft /></button>
            <div className="month-nav-title">
              <strong>{MONTH_LABELS[monthCursor.getMonth()]} {monthCursor.getFullYear()}</strong>
              <button type="button" className="today-button" onClick={() => setMonthCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoje</button>
            </div>
            <button type="button" onClick={() => setMonthCursor((current) => addMonths(current, 1))} aria-label="Próximo mês"><ChevronRight /></button>
          </div>
        </div>

        <section className="calendar-section" aria-label="Calendário mensal">
          {!turmaId ? (
            <div className="state-card"><Calendar /><p>Escolha sua turma para ver a agenda.</p></div>
          ) : loading ? (
            <div className="state-card"><LoaderCircle className="spin" /><p>Consultando a agenda…</p></div>
          ) : loadError ? (
            <div className="state-card error"><DoorOpen /><p>{loadError}</p></div>
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
                {activity.createdByEmail && <span className="preview-author">Publicado por {activity.createdByEmail}</span>}
              </div>
            ))}
          </div>
          <span className="preview-footnote">Clique no dia para abrir os detalhes.</span>
        </div>,
        document.body,
      )}

      {selectedDay && (
        <DayDetail day={selectedDay} activities={activitiesByDay.get(dateKey(selectedDay)) ?? []} onAddActivity={() => openAdminForDay(selectedDay)} onClose={() => setSelectedDay(null)} />
      )}

      {!turmaId && <TurmaPickerModal onChoose={chooseTurma} />}

      {menuOpen && (
        <SideMenu
          onClose={() => setMenuOpen(false)}
          onOpenConfig={() => { setConfigOpen(true); setMenuOpen(false) }}
          onOpenAdmin={() => { openAdmin(); setMenuOpen(false) }}
          onOpenMySuggestions={() => { setMySuggestionsOpen(true); setMenuOpen(false) }}
          onOpenPolls={() => { setPollsOpen(true); setMenuOpen(false) }}
          onOpenFeedback={() => { setFeedbackOpen(true); setMenuOpen(false) }}
          onOpenNotifications={() => {
            setNotificationsOpen(true)
            setMenuOpen(false)
            if (turmaId) setNotificationsSeenAt(markNotificationsSeenNow(turmaId))
          }}
          onOpenDocs={() => { setDocsOpen(true); setMenuOpen(false) }}
          unseenNotifications={unseenNotifications}
        />
      )}

      {docsOpen && <DocsDialog onClose={() => setDocsOpen(false)} />}

      {suggestOpen && turmaId && <SuggestDialog turmaId={turmaId} onClose={() => setSuggestOpen(false)} />}

      {mySuggestionsOpen && <MySuggestionsDialog onClose={() => setMySuggestionsOpen(false)} />}

      {feedbackOpen && <FeedbackDialog turmaId={turmaId} onClose={() => setFeedbackOpen(false)} />}

      {pollsOpen && turmaId && <PollsDialog turmaId={turmaId} loadAdminProfile={loadOrClaimAdminProfile} onClose={() => setPollsOpen(false)} />}

      {notificationsOpen && <NotificationsDialog activities={recentActivities} onClose={() => setNotificationsOpen(false)} />}

      {showAnnouncement && announcement && (
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

      {adminOpen && <AdminDialog publicTurmaId={turmaId} quickCreateDate={quickCreateDate} onClose={closeAdmin} />}

      <VLibrasWidget />
    </div>
  )
}

function VLibrasWidget() {
  useEffect(() => {
    if (document.getElementById('vlibras-script')) return
    const script = document.createElement('script')
    script.id = 'vlibras-script'
    script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js'
    script.onload = () => {
      const vlibras = (window as unknown as { VLibras?: { Widget: new (url: string) => unknown } }).VLibras
      if (vlibras) new vlibras.Widget('https://vlibras.gov.br/app')
    }
    document.body.appendChild(script)
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

function SideMenu({ onClose, onOpenConfig, onOpenAdmin, onOpenMySuggestions, onOpenPolls, onOpenFeedback, onOpenNotifications, onOpenDocs, unseenNotifications }: {
  onClose: () => void
  onOpenConfig: () => void
  onOpenAdmin: () => void
  onOpenMySuggestions: () => void
  onOpenPolls: () => void
  onOpenFeedback: () => void
  onOpenNotifications: () => void
  onOpenDocs: () => void
  unseenNotifications: number
}) {
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
        <nav className="side-menu-list">
          <button type="button" onClick={onOpenNotifications}>
            <Bell size={18} /> Notificações
            {unseenNotifications > 0 && <span className="notif-count">{unseenNotifications}</span>}
          </button>
          <button type="button" onClick={onOpenPolls}><Vote size={18} /> Enquetes da turma</button>
          <button type="button" onClick={onOpenConfig}><Settings size={18} /> Configurações</button>
          <button type="button" onClick={onOpenDocs}><BookOpen size={18} /> Como funciona</button>
          <button type="button" onClick={onOpenAdmin}><KeyRound size={18} /> Sou representante</button>
          <button type="button" onClick={onOpenFeedback}><MessageSquarePlus size={18} /> Comentar melhoria</button>
          <button type="button" onClick={onOpenMySuggestions}><ListChecks size={18} /> Minhas sugestões</button>
          <a className="side-menu-external" href="https://tech-2d.github.io/professores/" target="_blank" rel="noopener noreferrer">
            <MapPin size={18} /> Cadê o professor?
            <ExternalLink size={14} className="external-icon" />
          </a>
        </nav>
      </aside>
    </div>
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
          <div className="config-section">
            <h3>Tema</h3>
            <div className="theme-options">
              {THEMES.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`theme-swatch ${theme === value ? 'active' : ''}`}
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

function TurmaPickerModal({ onChoose }: { onChoose: (turmaId: string) => void }) {
  const [search, setSearch] = useState('')
  const options = CLASS_NAMES.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase()))
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
      await sendPasswordResetEmail(auth, email.trim())
      setAuthNotice('Se o e-mail tiver uma conta, você receberá um link para redefinir a senha.')
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
    setBusy(true)
    setError('')
    try {
      await addDoc(collection(db, 'feedback'), {
        message: message.trim(), turmaId: turmaId ?? null,
        createdBy: currentUser.uid, createdByEmail: currentUser.email,
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
          <h2 id="feedback-title">Comentar melhoria</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
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

function DayDetail({ day, activities, onAddActivity, onClose }: { day: Date; activities: Activity[]; onAddActivity: () => void; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="day-dialog" role="dialog" aria-modal="true" aria-labelledby="day-title">
        <div className="dialog-header">
          <h2 id="day-title">{day.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        <div className="day-create-bar">
          <span>Cadastro para representantes</span>
          <button type="button" className="secondary-button" onClick={onAddActivity}><Plus size={17} /> Cadastrar atividade</button>
        </div>
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
              {activity.createdByEmail && <p className="activity-author">Publicado por {activity.createdByEmail}</p>}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

type AdminDialogProps = {
  publicTurmaId: string | null
  quickCreateDate: string | null
  onClose: () => void
}

function AdminDialog({ publicTurmaId, quickCreateDate, onClose }: AdminDialogProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [entryMode, setEntryMode] = useState<'login' | 'request'>(window.location.hash === '#representante' ? 'request' : 'login')
  const [requestEmail, setRequestEmail] = useState('')
  const [requestTurma, setRequestTurma] = useState<string>(publicTurmaId ?? CLASS_NAMES[0])
  const [requestId, setRequestId] = useState(readRepresentativeRequestId)
  const [trackingCode, setTrackingCode] = useState('')
  const [requestRecord, setRequestRecord] = useState<RepresentativeRequest | null>(null)
  const [requestError, setRequestError] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [accessError, setAccessError] = useState('')
  const [busy, setBusy] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [managedTurma, setManagedTurma] = useState<string>(publicTurmaId ?? CLASS_NAMES[0])
  const [managedActivities, setManagedActivities] = useState<Activity[]>([])
  const [globalActivities, setGlobalActivities] = useState<Activity[]>([])
  const [managedSuggestions, setManagedSuggestions] = useState<Suggestion[]>([])
  const [representativeRequests, setRepresentativeRequests] = useState<RepresentativeRequest[]>([])
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([])
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [announcementDraft, setAnnouncementDraft] = useState('')
  const [adminSearch, setAdminSearch] = useState('')
  const [adminTab, setAdminTab] = useState<'activities' | 'suggestions' | 'representatives' | 'site'>('activities')
  const [formOpen, setFormOpen] = useState(false)
  const [quickCreateActive, setQuickCreateActive] = useState(false)
  const [editing, setEditing] = useState<Activity | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [isGlobalForm, setIsGlobalForm] = useState(false)
  const [hasTime, setHasTime] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const [closingSuggestion, setClosingSuggestion] = useState<Suggestion | null>(null)
  const [resolution, setResolution] = useState<SuggestionResolution>('feito')
  const [reviewComment, setReviewComment] = useState('')
  const [resolutionError, setResolutionError] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (closingSuggestion) setClosingSuggestion(null)
      else onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closingSuggestion, onClose])

  useEffect(() => {
    let requestId = 0
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const currentRequest = ++requestId
      setUser(currentUser)
      setProfile(null)
      setAccessError('')
      setAuthChecked(!currentUser)
      if (!currentUser) return
      try {
        const data = await loadOrClaimAdminProfile(currentUser)
        if (currentRequest === requestId) {
          setProfile(data)
          if (data?.role === 'representante' && data.turmaId) setManagedTurma(data.turmaId)
          if (!data) setAccessError('Esta conta ainda não foi aprovada para representar uma turma.')
        }
      } catch {
        if (currentRequest === requestId) {
          setProfile(null)
          setAccessError('Não foi possível conferir o acesso agora. Tente novamente.')
        }
      } finally {
        if (currentRequest === requestId) setAuthChecked(true)
      }
    })
    return () => {
      requestId += 1
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!quickCreateDate || !profile) return
    if (!canCreateForSelectedClass(profile, publicTurmaId)) return
    if (profile.role === 'superadmin' && publicTurmaId) setManagedTurma(publicTurmaId)
    setAdminTab('activities')
    setEditing(null)
    setForm({ ...emptyForm, date: quickCreateDate })
    setIsGlobalForm(false)
    setHasTime(false)
    setSaveError('')
    setQuickCreateActive(true)
    setFormOpen(true)
  }, [quickCreateDate, profile, publicTurmaId])

  useEffect(() => {
    if (!requestId) {
      setRequestRecord(null)
      return
    }
    return onSnapshot(doc(db, 'representativeRequests', requestId), (snapshot) => {
      setRequestRecord(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as RepresentativeRequest) : null)
      setRequestError(snapshot.exists() ? '' : 'Solicitação não encontrada. Envie uma nova solicitação.')
    }, () => setRequestError('Não foi possível consultar sua solicitação. Tente novamente mais tarde.'))
  }, [requestId])

  useEffect(() => {
    if (!profile || !managedTurma) return
    const activitiesQuery = query(collection(db, 'activities'), where('turmaId', '==', managedTurma))
    return onSnapshot(activitiesQuery, (snapshot) => {
      setManagedActivities(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Activity))
    })
  }, [profile, managedTurma])

  useEffect(() => {
    if (!profile) return
    const globalQuery = query(collection(db, 'activities'), where('turmaId', '==', null))
    return onSnapshot(globalQuery, (snapshot) => {
      setGlobalActivities(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Activity))
    })
  }, [profile])

  useEffect(() => {
    if (!profile || !managedTurma) return
    const suggestionsQuery = query(collection(db, 'suggestions'), where('turmaId', '==', managedTurma))
    return onSnapshot(suggestionsQuery, (snapshot) => {
      setManagedSuggestions(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Suggestion))
    })
  }, [profile, managedTurma])

  const isSuperAdmin = profile?.role === 'superadmin'

  useEffect(() => {
    if (!isSuperAdmin) return
    const pendingQuery = query(collection(db, 'representativeRequests'), where('status', '==', 'pendente'))
    return onSnapshot(pendingQuery, (snapshot) => {
      setRepresentativeRequests(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as RepresentativeRequest))
    }, () => setNotice('Não foi possível carregar as solicitações de representantes.'))
  }, [isSuperAdmin])

  useEffect(() => {
    if (!isSuperAdmin) return
    return onSnapshot(collection(db, 'feedback'), (snapshot) => {
      setFeedbackList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Feedback))
    })
  }, [isSuperAdmin])

  useEffect(() => {
    if (!isSuperAdmin) return
    return onSnapshot(doc(db, 'announcement', 'latest'), (snapshot) => {
      const data = snapshot.exists() ? (snapshot.data() as Announcement) : null
      setAnnouncement(data)
      setAnnouncementDraft(data?.message ?? '')
    })
  }, [isSuperAdmin])

  const isRepresentante = profile?.role === 'representante'
  const quickCreateMismatch = Boolean(quickCreateDate && profile && !canCreateForSelectedClass(profile, publicTurmaId))
  const turmaMismatch = isRepresentante && !!profile?.turmaId && !(CLASS_NAMES as readonly string[]).includes(profile.turmaId)
  const filteredActivities = managedActivities
    .filter((activity) => matchesSearch(activity, adminSearch))
    .sort((a, b) => a.date.localeCompare(b.date) || compareActivities(a, b))
  const filteredGlobalActivities = globalActivities
    .filter((activity) => matchesSearch(activity, adminSearch))
    .sort((a, b) => a.date.localeCompare(b.date) || compareActivities(a, b))
  const canManageGlobalActivity = (activity: Activity) => isSuperAdmin || activity.createdBy === user?.uid
  const pendingSuggestions = managedSuggestions
    .filter((item) => item.status === 'pendente')
    .sort((a, b) => a.date.localeCompare(b.date))
  const processedSuggestions = managedSuggestions
    .filter((item) => item.status !== 'pendente' && !item.closedAt)
    .sort((a, b) => a.date.localeCompare(b.date))

  async function logIn(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setAuthError('')
    setAuthNotice('')
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      setPassword('')
    } catch (error) {
      if (error instanceof FirebaseError && error.code === 'auth/too-many-requests') {
        setAuthError('Muitas tentativas de entrada. Aguarde um pouco antes de tentar novamente.')
      } else if (error instanceof FirebaseError && error.code === 'auth/network-request-failed') {
        setAuthError('Não foi possível conectar ao Firebase. Confira sua internet e tente novamente.')
      } else {
        setAuthError('E-mail ou senha inválidos.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword() {
    const normalizedEmail = normalizeRepresentativeEmail(email)
    if (!isValidRepresentativeEmail(normalizedEmail)) {
      setAuthError('Informe seu e-mail para recuperar a senha.')
      return
    }
    setBusy(true)
    setAuthError('')
    setAuthNotice('')
    try {
      await sendPasswordResetEmail(auth, normalizedEmail)
      setAuthNotice('Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha.')
    } catch {
      setAuthError('Não foi possível enviar o link agora. Tente novamente mais tarde.')
    } finally {
      setBusy(false)
    }
  }

  async function submitRepresentativeRequest(event: FormEvent) {
    event.preventDefault()
    const normalizedEmail = normalizeRepresentativeEmail(requestEmail)
    if (!isValidRepresentativeEmail(normalizedEmail)) {
      setRequestError('Informe um e-mail válido.')
      return
    }
    setBusy(true)
    setRequestError('')
    try {
      const created = await addDoc(collection(db, 'representativeRequests'), {
        email: normalizedEmail,
        turmaId: requestTurma,
        status: 'pendente',
        createdAt: serverTimestamp(),
      })
      storeRepresentativeRequestId(created.id)
      setRequestId(created.id)
      setRequestEmail(normalizedEmail)
    } catch {
      setRequestError('Não foi possível enviar a solicitação. Confira sua conexão e tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  function lookupRepresentativeRequest(event: FormEvent) {
    event.preventDefault()
    const code = trackingCode.trim()
    if (!/^[A-Za-z0-9]{20}$/.test(code)) {
      setRequestError('Confira o código da solicitação e tente novamente.')
      return
    }
    setRequestError('')
    storeRepresentativeRequestId(code)
    setRequestId(code)
  }

  async function registerRepresentative(event: FormEvent) {
    event.preventDefault()
    if (!requestRecord || requestRecord.status !== 'aprovada') return
    setBusy(true)
    setRequestError('')
    try {
      const fresh = await getDoc(doc(db, 'representativeRequests', requestRecord.id))
      if (!fresh.exists() || fresh.data().status !== 'aprovada' || fresh.data().email !== requestRecord.email || fresh.data().turmaId !== requestRecord.turmaId) {
        setRequestError('Esta solicitação ainda não está aprovada.')
        return
      }
      await createUserWithEmailAndPassword(auth, requestRecord.email, registerPassword)
      setRegisterPassword('')
    } catch (error) {
      if (error instanceof FirebaseError && error.code === 'auth/email-already-in-use') {
        setRequestError('Este e-mail já tem uma conta. Entre com sua senha ou use “Esqueci minha senha”.')
      } else if (error instanceof FirebaseError && error.code === 'auth/weak-password') {
        setRequestError('Escolha uma senha mais forte, com pelo menos 6 caracteres.')
      } else {
        setRequestError('Não foi possível criar a conta. Tente novamente; se a conta já foi criada, entre com ela.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function retryRepresentativeAccess() {
    if (!user) return
    setBusy(true)
    setAccessError('')
    try {
      const data = await loadOrClaimAdminProfile(user)
      setProfile(data)
      if (data?.role === 'representante' && data.turmaId) setManagedTurma(data.turmaId)
      if (!data) setAccessError('Esta conta ainda não foi aprovada para representar uma turma.')
    } catch {
      setAccessError('Não foi possível conferir o acesso agora. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function reviewRepresentativeRequest(item: RepresentativeRequest, approved: boolean) {
    if (!isSuperAdmin) return
    if (!isValidRepresentativeEmail(item.email) || !(CLASS_NAMES as readonly string[]).includes(item.turmaId)) {
      setNotice('Esta solicitação tem e-mail ou turma inválida e não pode ser aprovada.')
      return
    }
    setBusy(true)
    try {
      if (approved) {
        const batch = writeBatch(db)
        batch.set(doc(db, 'representativeInvites', item.email), {
          email: item.email,
          turmaId: item.turmaId,
          requestId: item.id,
          approvedAt: serverTimestamp(),
        })
        batch.update(doc(db, 'representativeRequests', item.id), { status: 'aprovada', reviewedAt: serverTimestamp() })
        await batch.commit()
      } else {
        await updateDoc(doc(db, 'representativeRequests', item.id), { status: 'rejeitada', reviewedAt: serverTimestamp() })
      }
      setNotice(approved ? 'E-mail aprovado. A pessoa já pode criar a conta com uma senha.' : 'Solicitação recusada.')
    } catch {
      setNotice('Não foi possível avaliar a solicitação. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  function startCreate() {
    setEditing(null)
    setForm({ ...emptyForm, date: dateKey(new Date()) })
    setIsGlobalForm(false)
    setHasTime(false)
    setSaveError('')
    setQuickCreateActive(false)
    setFormOpen(true)
  }

  function startEdit(activity: Activity) {
    setEditing(activity)
    setForm({ title: activity.title, description: activity.description, type: activity.type, subject: activity.subject ?? null, date: activity.date, time: activity.time })
    setIsGlobalForm(activity.turmaId === null)
    setHasTime(Boolean(activity.time))
    setSaveError('')
    setQuickCreateActive(false)
    setFormOpen(true)
  }

  async function saveActivity(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setSaveError('')
    try {
      const payload = { ...form, subject: form.subject ?? null, time: hasTime ? form.time : null, turmaId: isGlobalForm ? null : managedTurma }
      if (editing) {
        await updateDoc(doc(db, 'activities', editing.id), { ...payload, updatedAt: serverTimestamp() })
        setNotice('Atividade atualizada.')
      } else {
        await addDoc(collection(db, 'activities'), {
          ...payload,
          createdBy: user?.uid,
          createdByEmail: user?.email ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        setNotice(isGlobalForm ? 'Evento geral adicionado.' : 'Atividade adicionada.')
      }
      setFormOpen(false)
      if (quickCreateActive && !editing) onClose()
      else window.setTimeout(() => setNotice(''), 2800)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Não foi possível salvar a atividade.')
    } finally {
      setBusy(false)
    }
  }

  async function removeActivity(activity: Activity) {
    if (!window.confirm(`Excluir "${activity.title}"?`)) return
    try {
      await deleteDoc(doc(db, 'activities', activity.id))
      setNotice('Atividade excluída.')
      window.setTimeout(() => setNotice(''), 2800)
    } catch {
      setNotice('Não foi possível excluir a atividade.')
    }
  }

  async function approveSuggestion(suggestion: Suggestion) {
    try {
      await addDoc(collection(db, 'activities'), {
        title: suggestion.title,
        description: suggestion.description,
        type: suggestion.type,
        subject: suggestion.subject ?? null,
        date: suggestion.date,
        time: suggestion.time,
        turmaId: suggestion.turmaId,
        createdBy: user?.uid,
        createdByEmail: user?.email ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      await updateDoc(doc(db, 'suggestions', suggestion.id), { status: 'aprovada', updatedAt: serverTimestamp() })
      setNotice('Sugestão aprovada e adicionada à agenda.')
      window.setTimeout(() => setNotice(''), 2800)
    } catch {
      setNotice('Não foi possível aprovar a sugestão.')
    }
  }

  async function rejectSuggestion(suggestion: Suggestion) {
    try {
      await updateDoc(doc(db, 'suggestions', suggestion.id), { status: 'rejeitada', updatedAt: serverTimestamp() })
    } catch {
      setNotice('Não foi possível rejeitar a sugestão.')
    }
  }

  function startClosingSuggestion(suggestion: Suggestion) {
    setClosingSuggestion(suggestion)
    setResolution('feito')
    setReviewComment('')
    setResolutionError('')
  }

  async function closeSuggestion(event: FormEvent) {
    event.preventDefault()
    if (!closingSuggestion) return
    const comment = reviewComment.trim()
    if (!comment) {
      setResolutionError('Escreva um comentário antes de encerrar a sugestão.')
      return
    }
    setBusy(true)
    setResolutionError('')
    try {
      await updateDoc(doc(db, 'suggestions', closingSuggestion.id), {
        resolution,
        reviewComment: comment,
        closedAt: serverTimestamp(),
      })
      setClosingSuggestion(null)
      setNotice('Sugestão encerrada. O aluno poderá ver sua resposta em Minhas sugestões.')
      window.setTimeout(() => setNotice(''), 4000)
    } catch {
      setResolutionError('Não foi possível encerrar a sugestão. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function discardFeedback(item: Feedback) {
    if (!window.confirm('Remover este comentário da lista?')) return
    try {
      await deleteDoc(doc(db, 'feedback', item.id))
    } catch {
      setNotice('Não foi possível remover o comentário.')
    }
  }

  async function publishAnnouncement() {
    const message = announcementDraft.trim()
    if (!message) return
    setBusy(true)
    try {
      await setDoc(doc(db, 'announcement', 'latest'), { message, updatedAt: serverTimestamp() })
      setNotice('Aviso publicado para todos.')
      window.setTimeout(() => setNotice(''), 2800)
    } catch {
      setNotice('Não foi possível publicar o aviso.')
    } finally {
      setBusy(false)
    }
  }

  async function removeAnnouncement() {
    if (!window.confirm('Remover o aviso atual?')) return
    try {
      await deleteDoc(doc(db, 'announcement', 'latest'))
      setAnnouncementDraft('')
      setNotice('Aviso removido.')
      window.setTimeout(() => setNotice(''), 2800)
    } catch {
      setNotice('Não foi possível remover o aviso.')
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-title">
        <div className="dialog-header">
          <div><p className="eyebrow dark">ACESSO RESTRITO</p><h2 id="admin-title">Área administrativa</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>

        {!authChecked ? (
          <div className="state-card"><LoaderCircle className="spin" /><p>Verificando acesso…</p></div>
        ) : !user && entryMode === 'login' ? (
          <form className="login-form" onSubmit={logIn}>
            <div className="login-symbol"><KeyRound /></div>
            <h3>Entre para gerenciar a agenda</h3>
            <p>Use o e-mail e a senha da sua conta.</p>
            <label htmlFor="admin-email">E-mail</label>
            <input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" autoFocus required />
            <label htmlFor="admin-password">Senha</label>
            <input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            {authError && <p className="form-error">{authError}</p>}
            {authNotice && <p className="access-notice" role="status">{authNotice}</p>}
            <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <>Entrar <ArrowRight /></>}</button>
            <button type="button" className="access-switch" onClick={resetPassword} disabled={busy}>Esqueci minha senha</button>
            <button type="button" className="access-switch" onClick={() => setEntryMode('request')}>Quer representar sua turma? Solicite acesso</button>
          </form>
        ) : !user ? (
          <div className="representative-entry">
            <div className="access-steps" aria-label="Etapas para representar uma turma">
              <span>1. Solicite</span><span>2. Aguarde aprovação</span><span>3. Crie sua conta</span>
            </div>
            <h3>Representar minha turma</h3>
            {requestRecord ? (
              <div className="request-status">
                <span className={`status-badge status-${requestRecord.status}`}>{requestRecord.status}</span>
                <strong>{requestRecord.email}</strong>
                <p>Turma: {requestRecord.turmaId}</p>
                <p className="request-code">Código da solicitação: <code>{requestRecord.id}</code></p>
                {requestRecord.status === 'pendente' && <p>Seu pedido está em análise. Esta tela atualiza quando o administrador responder.</p>}
                {requestRecord.status === 'rejeitada' && <p>Esta solicitação não foi aprovada. Se necessário, envie uma nova com os dados corretos.</p>}
                {requestRecord.status === 'aprovada' && (
                  <form className="access-form" onSubmit={registerRepresentative}>
                    <p>E-mail aprovado. Crie uma senha para entrar diretamente na administração da sua turma.</p>
                    <label htmlFor="representative-password">Criar senha</label>
                    <input id="representative-password" type="password" minLength={6} value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} autoComplete="new-password" required />
                    <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : 'Criar conta'}</button>
                  </form>
                )}
                <button type="button" className="access-switch" onClick={() => { storeRepresentativeRequestId(''); setRequestId(''); setRequestRecord(null); setRequestError('') }}>Fazer outra solicitação</button>
              </div>
            ) : (
              <>
                <p>Informe seu e-mail e a turma que deseja representar. Um administrador vai avaliar o pedido.</p>
                <form className="access-form" onSubmit={submitRepresentativeRequest}>
                  <label htmlFor="representative-email">Seu e-mail</label>
                  <input id="representative-email" type="email" value={requestEmail} onChange={(event) => setRequestEmail(event.target.value)} autoComplete="email" required />
                  <label htmlFor="representative-class">Sua turma</label>
                  <select id="representative-class" value={requestTurma} onChange={(event) => setRequestTurma(event.target.value)}>
                    {CLASS_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                  <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : 'Enviar solicitação'}</button>
                </form>
                <form className="request-lookup" onSubmit={lookupRepresentativeRequest}>
                  <label htmlFor="request-code">Já solicitou? Consulte pelo código mostrado após o envio.</label>
                  <div><input id="request-code" value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} placeholder="Código da solicitação" /><button className="secondary-button">Consultar</button></div>
                </form>
              </>
            )}
            {requestError && <p className="form-error" role="alert">{requestError}</p>}
            <button type="button" className="access-switch" onClick={() => setEntryMode('login')}>Já tenho conta · Entrar</button>
          </div>
        ) : !profile ? (
          <div className="unauthorized access-onboarding">
            <DoorOpen /><h3>Esta conta ainda não tem acesso</h3>
            <p>{accessError || `Ainda não encontramos uma turma aprovada para ${user.email}.`}</p>
            {notice && <p className="access-notice">{notice}</p>}
            <div className="access-actions">
              <button className="primary-button" onClick={retryRepresentativeAccess} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : 'Atualizar acesso'}</button>
              <button className="access-switch" onClick={() => signOut(auth)}>Entrar com outra conta</button>
            </div>
          </div>
        ) : turmaMismatch ? (
          <div className="unauthorized">
            <DoorOpen /><h3>Turma não reconhecida</h3><p>O campo <code>turmaId</code> deste representante ("{profile?.turmaId}") não corresponde a nenhuma turma em <code>src/classNames.ts</code>. Corrija a grafia no documento <code>admins/{user.uid}</code> no Firestore — o texto precisa ser idêntico.</p>
            <button className="secondary-button" onClick={() => signOut(auth)}>Sair</button>
          </div>
        ) : (
          <div className="admin-content">
            {quickCreateMismatch && <div className="quick-create-warning" role="alert">Esta conta representa {profile?.turmaId}. Para cadastrar diretamente por um dia, volte ao calendário e selecione essa turma.</div>}
            <div className="admin-body">
              <div className="admin-main">
                <div className="admin-tabs">
                  <button type="button" className={adminTab === 'activities' ? 'active' : ''} onClick={() => setAdminTab('activities')}>Atividades</button>
                  <button type="button" className={adminTab === 'suggestions' ? 'active' : ''} onClick={() => setAdminTab('suggestions')}>
                    Sugestões
                    {pendingSuggestions.length > 0 && <span className="notif-count">{pendingSuggestions.length}</span>}
                  </button>
                  {isSuperAdmin && (
                    <button type="button" className={adminTab === 'representatives' ? 'active' : ''} onClick={() => setAdminTab('representatives')}>
                      Representantes
                      {representativeRequests.length > 0 && <span className="notif-count">{representativeRequests.length}</span>}
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button type="button" className={adminTab === 'site' ? 'active' : ''} onClick={() => setAdminTab('site')}>
                      Site
                      {feedbackList.length > 0 && <span className="notif-count">{feedbackList.length}</span>}
                    </button>
                  )}
                </div>

                <div className="admin-panel">
                  {adminTab === 'activities' && (
                    <>
                      <div className="admin-list-heading"><strong>Atividades cadastradas</strong><input aria-label="Buscar atividades" placeholder="Buscar por título ou descrição" value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} /></div>
                      <div className="admin-list">
                        {filteredActivities.length === 0 ? <p className="admin-empty">Nenhuma atividade encontrada.</p> : filteredActivities.map((activity) => (
                          <article key={activity.id} className="admin-row compact">
                            <div className="avatar" style={{ color: ACTIVITY_TYPE_COLORS[activity.type] }}><UserRound /></div>
                            <div className="admin-row-main"><strong>{activity.title}</strong><span>{ACTIVITY_TYPE_LABELS[activity.type]}{activity.subject ? ` · ${activity.subject}` : ''}</span></div>
                            <div className="admin-row-meta"><span>{parseDateLabel(activity.date)}</span><strong>{activity.time ?? '—'}</strong></div>
                            <div className="row-actions">
                              <button onClick={() => startEdit(activity)} aria-label={`Editar ${activity.title}`}><Edit3 /></button>
                              <button className="danger" onClick={() => removeActivity(activity)} aria-label={`Excluir ${activity.title}`}><Trash2 /></button>
                            </div>
                          </article>
                        ))}
                      </div>

                      <div className="admin-list-heading"><strong>Eventos gerais</strong><span className="config-hint" style={{ margin: 0 }}>Valem para todas as turmas</span></div>
                      <div className="admin-list">
                        {filteredGlobalActivities.length === 0 ? <p className="admin-empty">Nenhum evento geral cadastrado.</p> : filteredGlobalActivities.map((activity) => (
                          <article key={activity.id} className="admin-row compact">
                            <div className="avatar" style={{ color: ACTIVITY_TYPE_COLORS[activity.type] }}><Megaphone /></div>
                            <div className="admin-row-main"><strong>{activity.title}</strong><span>{ACTIVITY_TYPE_LABELS[activity.type]}{activity.subject ? ` · ${activity.subject}` : ''} · {activity.createdByEmail ?? 'sem autor'}</span></div>
                            <div className="admin-row-meta"><span>{parseDateLabel(activity.date)}</span><strong>{activity.time ?? '—'}</strong></div>
                            {canManageGlobalActivity(activity) && (
                              <div className="row-actions">
                                <button onClick={() => startEdit(activity)} aria-label={`Editar ${activity.title}`}><Edit3 /></button>
                                <button className="danger" onClick={() => removeActivity(activity)} aria-label={`Excluir ${activity.title}`}><Trash2 /></button>
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                  {adminTab === 'suggestions' && (
                    <>
                      <div className="admin-list-heading">
                        <strong>Sugestões dos alunos</strong>
                        {pendingSuggestions.length > 0 && <span className="soon-badge pending">{pendingSuggestions.length} pendente{pendingSuggestions.length === 1 ? '' : 's'}</span>}
                      </div>
                      <div className="admin-list">
                        {pendingSuggestions.length === 0 ? <p className="admin-empty">Nenhuma sugestão pendente.</p> : pendingSuggestions.map((suggestion) => (
                          <article key={suggestion.id} className="admin-row compact">
                            <div className="avatar" style={{ color: ACTIVITY_TYPE_COLORS[suggestion.type] }}><Lightbulb /></div>
                            <div className="admin-row-main"><strong>{suggestion.title}</strong><span>{ACTIVITY_TYPE_LABELS[suggestion.type]}{suggestion.subject ? ` · ${suggestion.subject}` : ''} · {parseDateLabel(suggestion.date)}{suggestion.time ? ` · ${suggestion.time}` : ''}</span></div>
                            <div className="admin-row-meta"><span>{suggestion.description}</span></div>
                            <div className="row-actions">
                              <button onClick={() => approveSuggestion(suggestion)} aria-label={`Aprovar ${suggestion.title}`}><Check /></button>
                              <button className="danger" onClick={() => rejectSuggestion(suggestion)} aria-label={`Rejeitar ${suggestion.title}`}><X /></button>
                            </div>
                          </article>
                        ))}
                      </div>
                      {processedSuggestions.length > 0 && (
                        <>
                          <div className="admin-list-heading"><strong>Sugestões avaliadas</strong></div>
                          <div className="admin-list">
                            {processedSuggestions.map((suggestion) => (
                              <article key={suggestion.id} className="admin-row compact">
                                <div className="avatar"><Lightbulb /></div>
                                <div className="admin-row-main"><strong>{suggestion.title}</strong><span className={`status-badge status-${suggestion.status}`}>{SUGGESTION_STATUS_LABELS[suggestion.status]}</span></div>
                                <div className="admin-row-meta"><span>{parseDateLabel(suggestion.date)}</span></div>
                                <div className="row-actions">
                                  <button onClick={() => startClosingSuggestion(suggestion)} aria-label={`Encerrar ${suggestion.title}`} title="Encerrar e responder"><MessageSquarePlus /></button>
                                </div>
                              </article>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}
                  {isSuperAdmin && adminTab === 'representatives' && (
                    <>
                      <div className="admin-list-heading"><strong>Pedidos para representar uma turma</strong></div>
                      <p className="representative-hint">Confira o e-mail e a turma antes de aprovar. Depois da aprovação, a pessoa poderá criar a conta e entrar diretamente.</p>
                      <div className="admin-list">
                        {representativeRequests.length === 0 ? <p className="admin-empty">Nenhuma solicitação pendente.</p> : representativeRequests.map((item) => (
                          <article key={item.id} className="admin-row compact representative-row">
                            <div className="avatar"><UserRound /></div>
                            <div className="admin-row-main"><strong>{item.email}</strong><span>{item.turmaId}</span></div>
                            <div className="admin-row-meta"><span>Solicitado em</span><strong>{item.createdAt ? item.createdAt.toDate().toLocaleDateString('pt-BR') : '—'}</strong></div>
                            <div className="row-actions">
                              <button onClick={() => reviewRepresentativeRequest(item, true)} disabled={busy} aria-label={`Aprovar ${item.email}`} title="Aprovar"><Check /></button>
                              <button className="danger" onClick={() => reviewRepresentativeRequest(item, false)} disabled={busy} aria-label={`Recusar ${item.email}`} title="Recusar"><X /></button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                  {adminTab === 'site' && (
                    <>
                      <div className="admin-list-heading"><strong>Aviso para todos</strong></div>
                      <div className="announcement-editor">
                        <textarea
                          rows={4}
                          maxLength={500}
                          value={announcementDraft}
                          onChange={(event) => setAnnouncementDraft(event.target.value)}
                          placeholder="Ex.: Agora dá pra sugerir atividades! Toca no ícone de lâmpada no topo da agenda."
                        />
                        <div className="announcement-editor-actions">
                          <span className="config-hint">
                            {announcement?.updatedAt ? `Publicado em ${announcement.updatedAt.toDate().toLocaleString('pt-BR')}` : 'Nenhum aviso publicado no momento.'}
                          </span>
                          <div className="toolbar-actions">
                            {announcement && <button type="button" className="secondary-button" onClick={removeAnnouncement}>Remover aviso</button>}
                            <button type="button" className="primary-button compact" onClick={publishAnnouncement} disabled={busy || !announcementDraft.trim()}>
                              <Megaphone size={16} /> Publicar aviso
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="admin-list-heading">
                        <strong>Feedback do site</strong>
                        {feedbackList.length > 0 && <span className="soon-badge pending">{feedbackList.length}</span>}
                      </div>
                      <div className="admin-list">
                        {feedbackList.length === 0 ? <p className="admin-empty">Nenhum comentário recebido.</p> : feedbackList.map((item) => (
                          <article key={item.id} className="admin-row compact">
                            <div className="avatar"><MessageSquarePlus /></div>
                            <div className="admin-row-main"><strong>{item.createdByEmail ?? 'Enviado antes da identificação obrigatória'}</strong><span className="feedback-message">{item.message}</span></div>
                            <div className="admin-row-meta"><span>{item.turmaId ?? 'Geral'}</span><strong>{item.createdAt ? item.createdAt.toDate().toLocaleDateString('pt-BR') : '—'}</strong></div>
                            <div className="row-actions">
                              <button className="danger" onClick={() => discardFeedback(item)} aria-label="Remover comentário"><Trash2 /></button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <aside className="admin-sidebar">
                <div className="sidebar-block">
                  <span>Conectado como</span>
                  <strong>{user.email}</strong>
                  <button className="secondary-button" onClick={() => signOut(auth)}><LogOut size={17} /> Sair</button>
                </div>

                <div className="sidebar-block managed-turma">
                  <span>Gerenciando a turma</span>
                  {isRepresentante ? (
                    <strong>{managedTurma}</strong>
                  ) : (
                    <select value={managedTurma} onChange={(event) => setManagedTurma(event.target.value)}>
                      {CLASS_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  )}
                </div>

                {adminTab === 'activities' && (
                  <button className="primary-button compact" onClick={startCreate}><Plus size={18} /> Nova atividade</button>
                )}

                {notice && <div className="notice"><Check size={17} /> {notice}</div>}
              </aside>
            </div>
          </div>
        )}

        {formOpen && (
          <div className="form-overlay">
            <form className="activity-form" onSubmit={saveActivity}>
              <div className="form-title"><div><p className="eyebrow dark">ATIVIDADE</p><h3>{editing ? 'Editar atividade' : 'Adicionar atividade'}</h3></div><button type="button" className="icon-button" onClick={() => setFormOpen(false)}><X /></button></div>
              <div className="form-grid">
                <label className="wide">Título<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
                <label>Tipo<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as ActivityType })}>{ACTIVITY_TYPES.map((type) => <option value={type} key={type}>{ACTIVITY_TYPE_LABELS[type]}</option>)}</select></label>
                <label className="wide">Matéria<select value={form.subject ?? ''} onChange={(event) => setForm({ ...form, subject: event.target.value || null })}><option value="">Sem matéria específica</option>{SUBJECTS.map((subject) => <option value={subject} key={subject}>{subject}</option>)}</select></label>
                <label>Data<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
                <label className="toggle wide"><input type="checkbox" checked={isGlobalForm} onChange={(event) => setIsGlobalForm(event.target.checked)} /><span /> Evento geral (aparece em todas as turmas)</label>
                {isGlobalForm ? (
                  <p className="config-hint wide">Vai aparecer no calendário de todas as turmas, não só {isRepresentante ? 'da sua' : `de "${managedTurma}"`}.</p>
                ) : editing && editing.turmaId === null && (
                  <p className="config-hint wide">Vai deixar de ser geral e passar a valer só para {isRepresentante ? 'a sua turma' : `"${managedTurma}"`}.</p>
                )}
                <label className="toggle wide"><input type="checkbox" checked={hasTime} onChange={(event) => { setHasTime(event.target.checked); if (!event.target.checked) setForm({ ...form, time: null }) }} /><span /> Tem horário definido</label>
                {hasTime && <label>Horário<input required type="time" value={form.time ?? ''} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label>}
                <label className="wide">Descrição<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Detalhes, capítulos, critérios de entrega…" /></label>
              </div>
              {saveError && <p className="form-error">{saveError}</p>}
              <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary-button compact" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : 'Salvar atividade'}</button></div>
            </form>
          </div>
        )}

        {closingSuggestion && (
          <div className="form-overlay">
            <form className="activity-form resolution-form" onSubmit={closeSuggestion} aria-labelledby="resolution-title">
              <div className="form-title">
                <div><p className="eyebrow dark">SUGESTÃO</p><h3 id="resolution-title">Encerrar sugestão</h3></div>
                <button type="button" className="icon-button" onClick={() => setClosingSuggestion(null)} aria-label="Fechar"><X /></button>
              </div>
              <p className="resolution-context">{closingSuggestion.title}</p>
              <fieldset className="resolution-options">
                <legend>Essa sugestão foi feita?</legend>
                <label><input type="radio" name="resolution" value="feito" checked={resolution === 'feito'} onChange={() => setResolution('feito')} /> Sim, foi feito</label>
                <label><input type="radio" name="resolution" value="nao_feito" checked={resolution === 'nao_feito'} onChange={() => setResolution('nao_feito')} /> Não foi feito</label>
              </fieldset>
              <label className="resolution-comment">Comentário para o aluno
                <textarea required maxLength={500} rows={5} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Explique o que foi feito ou por que a sugestão não foi realizada." />
              </label>
              <p className="resolution-hint">Ao encerrar, a sugestão sai desta lista. O aluno poderá ver a resposta em “Minhas sugestões”.</p>
              {resolutionError && <p className="form-error" role="alert">{resolutionError}</p>}
              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={() => setClosingSuggestion(null)}>Cancelar</button>
                <button className="primary-button compact" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : 'Encerrar sugestão'}</button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  )
}

function parseDateLabel(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default App
