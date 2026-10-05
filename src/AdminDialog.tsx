import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Calendar, CalendarDays, Check, DoorOpen, Edit3, Globe, History, KeyRound, Lightbulb, ListChecks, LoaderCircle, LogOut, Megaphone, MessageSquarePlus, MessagesSquare, Plus, Paperclip, Repeat, ShieldCheck, HardDrive, StickyNote, Trash2, UserRound, Users, X } from 'lucide-react'
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { requestPasswordReset } from './passwordReset'
import { StorageAdminPanel } from './StorageAdminPanel'
import { RepresentativesPanel } from './RepresentativesPanel'
import { observePublicInfo } from './publicInfo'
import { ATTACHMENTS_ENABLED, deleteActivityWithAttachments, formatAttachmentSize, MAX_ATTACHMENTS, removeAttachment, uploadAttachment, validateAttachment } from './attachments'
import { FirebaseError } from 'firebase/app'
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { auth, db } from './firebase'
import { CLASS_NAMES } from './classNames'
import { normalizeClassName, isValidClassName, type ClassRequest } from './classRequests'
import { SUBJECTS } from './subjects'
import { REPEAT_DAYS, recurrenceLabel, validateCustomRepeat } from './recurrence'
import { deleteRecurrence } from './deleteRecurrence'
import { filterFeedback, isFeedbackCompleted, type FeedbackFilter } from './feedbackStatus'
import { RetentionPanel } from './RetentionPanel'
import { RepresentativesChat } from './RepresentativesChat'
import { creditForUpdate, isCreditEligible } from './publicCredit'
import { FeedbackConversation } from './FeedbackConversation'
import { canEditCalendarActivity } from './calendarPermissions'
import { activitySaveError } from './activityErrors'
import { compareActivities, dateKey, matchesSearch } from './calendar'
import { ACTIVITY_TYPES, ACTIVITY_TYPE_COLORS, ACTIVITY_TYPE_LABELS, SUGGESTION_STATUS_LABELS, type Activity, type ActivityAttachment, type ActivityInput, type ActivityType, type AdminProfile, type Announcement, type Feedback, type RecurringActivity, type Suggestion, type SuggestionResolution } from './types'
import { isValidRepresentativeEmail, normalizeRepresentativeEmail, readRepresentativeRequestId, storeRepresentativeRequestId, type RepresentativeRequest } from './representativeAccess'
import { canCreateForSelectedClass } from './quickCreate'
import { NoticesAdminPanel } from './NoticeBoard'
import { invalidateCatalog } from './publicQueries'
import { type SystemUpdate } from './systemUpdates'
import { loadOrClaimAdminProfile } from './adminAccess'

const emptyForm: Omit<ActivityInput, 'turmaId'> = {
  title: '',
  description: '',
  type: 'tarefa',
  subject: null,
  date: dateKey(new Date()),
  time: null,
}

type AdminDialogProps = {
  publicTurmaId: string | null
  classNames: string[]
  quickCreateDate: string | null
  quickEditActivity: Activity | null
  systemUpdates: SystemUpdate[]
  onClose: () => void
}

export default function AdminDialog({ publicTurmaId, classNames, quickCreateDate, quickEditActivity, systemUpdates, onClose }: AdminDialogProps) {
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
  const [classRequests, setClassRequests] = useState<ClassRequest[]>([])
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([])
  const [feedbackFilter, setFeedbackFilter] = useState<FeedbackFilter>('pending')
  const pendingFeedbackCount = useMemo(() => filterFeedback(feedbackList, 'pending').length, [feedbackList])
  const visibleFeedback = useMemo(() => filterFeedback(feedbackList, feedbackFilter), [feedbackList, feedbackFilter])
  const [conversation, setConversation] = useState<Feedback | null>(null)
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [announcementDraft, setAnnouncementDraft] = useState('')
  const [updateTitle, setUpdateTitle] = useState('')
  const [updateBody, setUpdateBody] = useState('')
  const [updateFeedbackId, setUpdateFeedbackId] = useState('')
  const [adminSearch, setAdminSearch] = useState('')
  const [adminTab, setAdminTab] = useState<'activities' | 'recurrences' | 'retention' | 'notices' | 'chat' | 'suggestions' | 'representatives' | 'classes' | 'site' | 'storage'>('activities')
  const [recurrences, setRecurrences] = useState<RecurringActivity[]>([])
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [repeatCustom, setRepeatCustom] = useState(false)
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const [repeatInterval, setRepeatInterval] = useState(1)
  const [repeatEndDate, setRepeatEndDate] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])
  const [quickCreateActive, setQuickCreateActive] = useState(false)
  const [editing, setEditing] = useState<Activity | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [editorAttachments, setEditorAttachments] = useState<ActivityAttachment[]>([])
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
      setFormOpen(false)
      setEditing(null)
      setSelectedFiles([])
      setEditorAttachments([])
      setClosingSuggestion(null)
      setConversation(null)
      setNotice('')
      setSaveError('')
      setManagedActivities([])
      setGlobalActivities([])
      setManagedSuggestions([])
      setRecurrences([])
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
    setSelectedFiles([])
    setEditorAttachments([])
    setIsGlobalForm(false)
    setHasTime(false)
    setRepeatWeekly(false)
    setRepeatEndDate('')
    setSaveError('')
    setQuickCreateActive(true)
    setFormOpen(true)
  }, [quickCreateDate, profile, publicTurmaId])

  useEffect(() => {
    if (!quickEditActivity || !canEditCalendarActivity(profile, quickEditActivity)) return
    const activity = quickEditActivity
    if (activity.turmaId) setManagedTurma(activity.turmaId)
    setAdminTab('activities')
    setEditing(activity)
    setForm({ title: activity.title, description: activity.description, type: activity.type, subject: activity.subject ?? null, date: activity.date, time: activity.time })
    setSelectedFiles([])
    setEditorAttachments(activity.attachments ?? [])
    setIsGlobalForm(activity.turmaId === null)
    setHasTime(Boolean(activity.time))
    setRepeatWeekly(false)
    setRepeatEndDate('')
    setSaveError('')
    setQuickCreateActive(false)
    setFormOpen(true)
  }, [quickEditActivity, profile])

  useEffect(() => {
    if (!requestId) {
      setRequestRecord(null)
      return
    }
    setRequestRecord(null)
    return observePublicInfo<{ request: { status: RepresentativeRequest['status']; turmaId: string } | null }>({ action: 'request-status', id: requestId }, data => {
      setRequestRecord(data.request ? { id: requestId, email: '', ...data.request } : null)
      setRequestError(data.request ? '' : 'Solicitação não encontrada. Envie uma nova solicitação.')
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
    if (!profile || !managedTurma || adminTab !== 'recurrences') return
    const recurrenceQuery = query(collection(db, 'recurringActivities'), where('turmaId', '==', managedTurma))
    return onSnapshot(recurrenceQuery, (snapshot) => {
      setRecurrences(snapshot.docs.filter(item => item.data().deleted !== true).map((item) => ({ id: item.id, ...item.data() }) as RecurringActivity))
    }, () => setNotice('Não foi possível carregar as repetições. Confira as regras do Firestore.'))
  }, [profile, managedTurma, adminTab])

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
    const pendingQuery = query(collection(db, 'agendaClassRequests'), where('status', '==', 'pendente'))
    return onSnapshot(pendingQuery, snapshot => {
      setClassRequests(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as ClassRequest))
    }, () => setNotice('Não foi possível carregar os pedidos de novas turmas. Confira as regras do Firestore.'))
  }, [isSuperAdmin])

  useEffect(() => {
    if (!isSuperAdmin) return
    return onSnapshot(collection(db, 'feedback'), (snapshot) => {
      setFeedbackList(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Feedback))
    })
  }, [isSuperAdmin])

  useEffect(() => {
    if (!isSuperAdmin || adminTab !== 'site') return
    return onSnapshot(doc(db, 'announcement', 'latest'), (snapshot) => {
      const data = snapshot.exists() ? (snapshot.data() as Announcement) : null
      setAnnouncement(data)
      setAnnouncementDraft(data?.message ?? '')
    })
  }, [isSuperAdmin, adminTab])

  const isRepresentante = profile?.role === 'representante'
  const quickCreateMismatch = Boolean(quickCreateDate && profile && !canCreateForSelectedClass(profile, publicTurmaId))
  const turmaMismatch = isRepresentante && !!profile?.turmaId && !classNames.includes(profile.turmaId)
  const filteredActivities = useMemo(() => managedActivities
    .filter((activity) => matchesSearch(activity, adminSearch))
    .sort((a, b) => a.date.localeCompare(b.date) || compareActivities(a, b)), [managedActivities, adminSearch])
  const filteredGlobalActivities = useMemo(() => globalActivities
    .filter((activity) => matchesSearch(activity, adminSearch))
    .sort((a, b) => a.date.localeCompare(b.date) || compareActivities(a, b)), [globalActivities, adminSearch])
  const canManageGlobalActivity = (activity: Activity) => isSuperAdmin || activity.createdBy === user?.uid
  const pendingSuggestions = useMemo(() => managedSuggestions
    .filter((item) => item.status === 'pendente')
    .sort((a, b) => a.date.localeCompare(b.date)), [managedSuggestions])
  const processedSuggestions = useMemo(() => managedSuggestions
    .filter((item) => item.status !== 'pendente' && !item.closedAt)
    .sort((a, b) => a.date.localeCompare(b.date)), [managedSuggestions])

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
      await requestPasswordReset(normalizedEmail)
      setAuthNotice('Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha. Confira também a pasta de spam ou lixo eletrônico.')
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
      const registrationEmail = normalizeRepresentativeEmail(requestEmail)
      if (!isValidRepresentativeEmail(registrationEmail)) {
        setRequestError('Informe o mesmo e-mail usado na solicitação.')
        return
      }
      // Account creation never grants representative access; the private invite check does.
      await createUserWithEmailAndPassword(auth, registrationEmail, registerPassword)
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
    if (!isValidRepresentativeEmail(item.email) || !classNames.includes(item.turmaId)) {
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

  async function reviewClassRequest(item: ClassRequest, approved: boolean) {
    if (!isSuperAdmin) return
    const className = normalizeClassName(item.className)
    if (!isValidClassName(className) || className !== item.className) {
      setNotice('O nome desta turma não é válido. Recuse e peça uma nova solicitação.')
      return
    }
    if (approved && classNames.includes(className)) {
      setNotice('Essa turma já tem uma agenda. Recuse o pedido duplicado.')
      return
    }
    setBusy(true)
    try {
      if (approved) {
        const batch = writeBatch(db)
        batch.set(doc(db, 'agendaClasses', className), { name: className, active: true, requestId: item.id, approvedAt: serverTimestamp() })
        batch.update(doc(db, 'agendaClassRequests', item.id), { status: 'aprovada', reviewedAt: serverTimestamp() })
        await batch.commit()
        await invalidateCatalog('agenda')
      } else {
        await updateDoc(doc(db, 'agendaClassRequests', item.id), { status: 'rejeitada', reviewedAt: serverTimestamp() })
      }
      setNotice(approved ? `Agenda de ${className} liberada. A turma já aparece no seletor; representantes ainda precisam solicitar acesso.` : `Pedido de ${className} recusado.`)
    } catch {
      setNotice('Não foi possível avaliar este pedido. Confira as regras do Firestore e tente novamente.')
    } finally { setBusy(false) }
  }

  function startCreate() {
    setEditing(null)
    setForm({ ...emptyForm, date: dateKey(new Date()) })
    setSelectedFiles([])
    setEditorAttachments([])
    setIsGlobalForm(false)
    setHasTime(false)
    setRepeatWeekly(false)
    setRepeatEndDate('')
    setSaveError('')
    setQuickCreateActive(false)
    setFormOpen(true)
  }

  function startEdit(activity: Activity) {
    if (!canEditCalendarActivity(profile, activity)) return
    setEditing(activity)
    setForm({ title: activity.title, description: activity.description, type: activity.type, subject: activity.subject ?? null, date: activity.date, time: activity.time })
    setSelectedFiles([])
    setEditorAttachments(activity.attachments ?? [])
    setIsGlobalForm(activity.turmaId === null)
    setHasTime(Boolean(activity.time))
    setRepeatWeekly(false)
    setRepeatEndDate('')
    setSaveError('')
    setQuickCreateActive(false)
    setFormOpen(true)
  }

  function selectAttachments(files: FileList | null) {
    if (!files?.length) return
    try {
      const added = Array.from(files)
      added.forEach(validateAttachment)
      if (editorAttachments.length + selectedFiles.length + added.length > MAX_ATTACHMENTS) throw new Error('Cada atividade pode ter até cinco anexos.')
      setSelectedFiles(current => [...current, ...added])
      setSaveError('')
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Arquivo inválido.') }
  }

  async function removeExistingAttachment(attachmentId: string) {
    if (!editing || !window.confirm('Remover este anexo da atividade?')) return
    setBusy(true)
    setSaveError('')
    try {
      await removeAttachment(editing.id, attachmentId)
      setEditorAttachments(current => current.filter(item => item.id !== attachmentId))
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Não foi possível remover o anexo.') }
    finally { setBusy(false) }
  }

  async function saveActivity(event: FormEvent) {
    event.preventDefault()
    if (!user || auth.currentUser?.uid !== user.uid) { setSaveError('Sessão não autorizada: entre novamente na sua conta antes de salvar.'); return }
    if (!profile || (!isGlobalForm && !canCreateForSelectedClass(profile, managedTurma))) {
      setSaveError('Falta de permissão: você não tem acesso para salvar atividades nesta turma. Peça ao administrador para conferir seu cadastro.'); return
    }
    if (!form.title.trim() || form.title.length > 120 || form.description.length > 2000) {
      setSaveError('Confira os dados: o título é obrigatório e deve ter até 120 caracteres; a descrição pode ter até 2.000 caracteres.'); return
    }
    if (repeatWeekly && selectedFiles.length) { setSaveError('Anexos são adicionados a atividades individuais, não a repetições.'); return }
    if (isGlobalForm && !isSuperAdmin && selectedFiles.length) { setSaveError('Apenas administradores podem anexar arquivos a eventos gerais.'); return }
    if (repeatWeekly && repeatCustom && !editing) {
      const validation = validateCustomRepeat(form.date, repeatEndDate, repeatDays, repeatInterval)
      if (validation) { setSaveError(validation); return }
    }
    if (repeatWeekly && repeatEndDate && repeatEndDate < form.date) {
      setSaveError('A data final precisa ser igual ou posterior à primeira data.')
      return
    }
    setBusy(true)
    setSaveError('')
    let savingAttachments = false
    let catalogChanged = false
    try {
      const payload = { ...form, subject: form.subject ?? null, time: hasTime ? form.time : null, turmaId: isGlobalForm ? null : managedTurma }
      let activityId = editing?.id
      if (repeatWeekly && !editing) {
        await addDoc(collection(db, 'recurringActivities'), {
          title: form.title.trim(),
          description: form.description.trim(),
          type: form.type,
          subject: form.subject ?? null,
          time: hasTime ? form.time : null,
          turmaId: managedTurma,
          startDate: form.date,
          endDate: repeatEndDate || null,
          ...(repeatCustom ? { weekdays: [...repeatDays].sort((a, b) => a - b), intervalWeeks: repeatInterval } : {}),
          active: true,
          createdBy: user?.uid,
          createdByEmail: user?.email ?? null,
          createdAt: serverTimestamp(),
        })
        setAdminTab('recurrences')
        setNotice('Repetição salva. As ocorrências aparecem após a próxima execução da automação.')
      } else if (editing) {
        await updateDoc(doc(db, 'activities', editing.id), { ...payload, updatedAt: serverTimestamp() })
        setNotice('Atividade atualizada.')
      } else {
        const created = await addDoc(collection(db, 'activities'), {
          ...payload,
          createdBy: user?.uid,
          createdByEmail: user?.email ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        activityId = created.id
        setEditing({ id: created.id, ...payload, attachments: [] })
        setNotice(isGlobalForm ? 'Evento geral adicionado.' : 'Atividade adicionada.')
      }
      catalogChanged = Boolean(activityId)
      if (activityId && selectedFiles.length) {
        savingAttachments = true
        for (let index = 0; index < selectedFiles.length; index += 1) {
          const attachment = await uploadAttachment(activityId, selectedFiles[index])
          setEditorAttachments(current => [...current, attachment])
          setSelectedFiles(selectedFiles.slice(index + 1))
        }
        setNotice('Atividade e anexos salvos.')
      }
      setFormOpen(false)
      if ((quickCreateActive && !editing) || quickEditActivity) onClose()
      else window.setTimeout(() => setNotice(''), 2800)
    } catch (error) {
      setSaveError(activitySaveError(error, savingAttachments))
    } finally {
      if (catalogChanged && !await invalidateCatalog('agenda')) setNotice('Atividade salva. A consulta pública será atualizada na próxima renovação do cache.')
      setBusy(false)
    }
  }

  async function toggleRecurrence(item: RecurringActivity) {
    setBusy(true)
    try {
      await updateDoc(doc(db, 'recurringActivities', item.id), { active: !item.active })
      setNotice(item.active
        ? 'Repetição pausada. As próximas ocorrências serão removidas pela automação.'
        : 'Repetição reativada. As próximas ocorrências serão criadas pela automação.')
    } catch {
      setNotice('Não foi possível alterar a repetição. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function removeRecurrence(item: RecurringActivity) {
    if (busy || !window.confirm(`Excluir a repetição "${item.title}"? As ocorrências de hoje em diante serão removidas. As anteriores permanecerão no histórico.`)) return
    setBusy(true)
    try {
      await deleteRecurrence(item)
      setNotice('Repetição excluída. As ocorrências anteriores foram preservadas.')
    } catch {
      setNotice('Não foi possível concluir a exclusão. Se a repetição foi pausada, ela continua na lista para você tentar excluir novamente.')
    } finally {
      await invalidateCatalog('agenda')
      setBusy(false)
    }
  }

  async function removeActivity(activity: Activity) {
    if (!window.confirm(`Excluir "${activity.title}"?`)) return
    try {
      if (activity.attachments?.length) await deleteActivityWithAttachments(activity.id)
      else await deleteDoc(doc(db, 'activities', activity.id))
      await invalidateCatalog('agenda')
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
      await invalidateCatalog('agenda')
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

  async function toggleFeedbackCompleted(item: Feedback) {
    if (!user || !isSuperAdmin || busy) return
    const completed = !isFeedbackCompleted(item)
    setBusy(true)
    try {
      await updateDoc(doc(db, 'feedback', item.id), {
        status: completed ? 'completed' : 'pending',
        completedAt: completed ? serverTimestamp() : null,
        completedBy: completed ? user.uid : null,
      })
      setNotice(completed ? 'Sugestão marcada como concluída. Ela continua no filtro Concluídas.' : 'Sugestão reaberta e movida para Pendentes.')
    } catch {
      setNotice('Não foi possível atualizar a sugestão. Tente novamente.')
    } finally { setBusy(false) }
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
      await invalidateCatalog('agenda')
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
      await invalidateCatalog('agenda')
      setAnnouncementDraft('')
      setNotice('Aviso removido.')
      window.setTimeout(() => setNotice(''), 2800)
    } catch {
      setNotice('Não foi possível remover o aviso.')
    }
  }

  async function publishSystemUpdate(event: FormEvent) {
    event.preventDefault()
    if (!user || !isSuperAdmin) return
    const title = updateTitle.trim()
    const body = updateBody.trim()
    const source = updateFeedbackId ? feedbackList.find(item => item.id === updateFeedbackId && isCreditEligible(item)) : undefined
    if (updateFeedbackId && !source) {
      setNotice('A sugestão não está mais autorizada para crédito público. Escolha outra.')
      return
    }
    if (!title || !body || title.length > 120 || body.length > 2000) {
      setNotice('Informe um título de até 120 caracteres e uma descrição de até 2.000 caracteres.')
      return
    }
    setBusy(true)
    try {
      await addDoc(collection(db, 'agendaUpdates'), {
        title, body, createdBy: user.uid, publishedAt: serverTimestamp(),
        ...(source ? creditForUpdate(source) : {}),
      })
      await invalidateCatalog('agenda')
      setUpdateTitle('')
      setUpdateBody('')
      setUpdateFeedbackId('')
      setNotice('Atualização publicada. Ela aparecerá na próxima abertura do site e no histórico.')
    } catch {
      setNotice('Não foi possível publicar a atualização. Tente novamente.')
    } finally {
      setBusy(false)
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
                <strong>Sua solicitação</strong>
                <p>Turma: {requestRecord.turmaId}</p>
                <p className="request-code">Código da solicitação: <code>{requestRecord.id}</code></p>
                {requestRecord.status === 'pendente' && <p>Seu pedido está em análise. Esta tela atualiza quando o administrador responder.</p>}
                {requestRecord.status === 'rejeitada' && <p>Esta solicitação não foi aprovada. Se necessário, envie uma nova com os dados corretos.</p>}
                {requestRecord.status === 'aprovada' && (
                  <form className="access-form" onSubmit={registerRepresentative}>
                    <p>E-mail aprovado. Crie uma senha para entrar diretamente na administração da sua turma.</p>
                    <label htmlFor="approved-email">E-mail usado na solicitação</label>
                    <input id="approved-email" type="email" value={requestEmail} onChange={event => setRequestEmail(event.target.value)} autoComplete="email" required />
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
                    {classNames.map((name) => <option key={name} value={name}>{name}</option>)}
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
          <div className="admin-content" inert={formOpen || Boolean(closingSuggestion)}>
            {quickCreateMismatch && <div className="quick-create-warning" role="alert">Esta conta representa {profile?.turmaId}. Para cadastrar diretamente por um dia, volte ao calendário e selecione essa turma.</div>}
            <div className="admin-body">
              <div className="admin-main">
                {(() => {
                  type AdminTabId = typeof adminTab
                  const groups: { id: string; label: string; icon: ReactNode; tabs: { id: AdminTabId; label: string; icon: ReactNode; count?: number }[] }[] = [
                    {
                      id: 'agenda',
                      label: 'Agenda',
                      icon: <CalendarDays size={16} />,
                      tabs: [
                        { id: 'activities', label: 'Atividades', icon: <ListChecks size={15} /> },
                        { id: 'recurrences', label: 'Repetições', icon: <Repeat size={15} /> },
                        { id: 'notices', label: 'Avisos', icon: <StickyNote size={15} /> },
                        { id: 'retention', label: 'Expurgo', icon: <Trash2 size={15} /> },
                      ],
                    },
                    {
                      id: 'community',
                      label: 'Comunidade',
                      icon: <MessagesSquare size={16} />,
                      tabs: [
                        { id: 'chat', label: 'Chat', icon: <MessagesSquare size={15} /> },
                        { id: 'suggestions', label: 'Sugestões', icon: <Lightbulb size={15} />, count: pendingSuggestions.length },
                      ],
                    },
                    ...(isSuperAdmin ? [{
                      id: 'admin',
                      label: 'Administração',
                      icon: <ShieldCheck size={16} />,
                      tabs: [
                        { id: 'representatives' as const, label: 'Representantes', icon: <Users size={15} />, count: representativeRequests.length },
                        { id: 'classes' as const, label: 'Novas turmas', icon: <Plus size={15} />, count: classRequests.length },
                        { id: 'storage' as const, label: 'Arquivos', icon: <HardDrive size={15} /> },
                        { id: 'site' as const, label: 'Site', icon: <Globe size={15} />, count: pendingFeedbackCount },
                      ],
                    }] : []),
                  ]
                  const activeGroup = groups.find((group) => group.tabs.some((tab) => tab.id === adminTab)) ?? groups[0]
                  return (
                    <nav className="admin-nav" aria-label="Seções do painel">
                      <div className="admin-groups" role="tablist" aria-label="Categorias">
                        {groups.map((group) => {
                          const groupCount = group.tabs.reduce((sum, tab) => sum + (tab.count ?? 0), 0)
                          return (
                            <button key={group.id} type="button" role="tab" aria-selected={group === activeGroup} className={group === activeGroup ? 'active' : ''} onClick={() => setAdminTab(group.tabs[0].id)}>
                              {group.icon}
                              <span>{group.label}</span>
                              {groupCount > 0 && group !== activeGroup && <span className="notif-count">{groupCount}</span>}
                            </button>
                          )
                        })}
                      </div>
                      <div className="admin-subtabs" role="tablist" aria-label={activeGroup.label}>
                        {activeGroup.tabs.map((tab) => (
                          <button key={tab.id} type="button" role="tab" aria-selected={tab.id === adminTab} className={tab.id === adminTab ? 'active' : ''} onClick={() => setAdminTab(tab.id)}>
                            {tab.icon}
                            <span>{tab.label}</span>
                            {!!tab.count && <span className="notif-count">{tab.count}</span>}
                          </button>
                        ))}
                      </div>
                    </nav>
                  )
                })()}

                <div className="admin-panel">
                  {adminTab === 'activities' && (
                    <>
                      <div className="admin-list-heading"><strong>Atividades cadastradas</strong><input aria-label="Buscar atividades" placeholder="Buscar por título ou descrição" value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} /></div>
                      <div className="admin-list">
                        {filteredActivities.length === 0 ? <p className="admin-empty">Nenhuma atividade encontrada.</p> : filteredActivities.map((activity) => (
                          <article key={activity.id} className="admin-row compact">
                            <div className="avatar" style={{ color: ACTIVITY_TYPE_COLORS[activity.type] }}><UserRound /></div>
                            <div className="admin-row-main"><strong>{activity.title}</strong><span>{ACTIVITY_TYPE_LABELS[activity.type]}{activity.subject ? ` · ${activity.subject}` : ''}{activity.recurringId ? ' · Atividade recorrente' : ''}</span></div>
                            <div className="admin-row-meta"><span>{parseDateLabel(activity.date)}</span><strong>{activity.time ?? '—'}</strong></div>
                            <div className="row-actions">
                              <button onClick={() => startEdit(activity)} aria-label={`Editar ${activity.title}`}><Edit3 /></button>
                              {!activity.recurringId && <button className="danger" onClick={() => removeActivity(activity)} aria-label={`Excluir ${activity.title}`}><Trash2 /></button>}
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
                                {canEditCalendarActivity(profile, activity) && <button onClick={() => startEdit(activity)} aria-label={`Editar ${activity.title}`}><Edit3 /></button>}
                                <button className="danger" onClick={() => removeActivity(activity)} aria-label={`Excluir ${activity.title}`}><Trash2 /></button>
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                  {adminTab === 'recurrences' && (
                    <>
                      <div className="admin-list-heading"><strong>Tarefas que se repetem</strong><span className="config-hint" style={{ margin: 0 }}>Semanais ou personalizadas</span></div>
                      <div className="admin-list">
                        {recurrences.length === 0 ? <p className="admin-empty">Nenhuma repetição cadastrada para esta turma.</p> : recurrences
                          .slice()
                          .sort((a, b) => a.startDate.localeCompare(b.startDate))
                          .map((item) => (
                            <article key={item.id} className="admin-row compact">
                              <div className="avatar" style={{ color: ACTIVITY_TYPE_COLORS[item.type] }}><Calendar /></div>
                              <div className="admin-row-main"><strong>{item.title}</strong><span>{ACTIVITY_TYPE_LABELS[item.type]}{item.subject ? ` · ${item.subject}` : ''} · {item.active ? 'Ativa' : 'Pausada'}</span></div>
                              <div className="admin-row-meta"><span>{recurrenceLabel(item)}</span><span>Desde {parseDateLabel(item.startDate)}</span><strong>{item.endDate ? `Até ${parseDateLabel(item.endDate)}` : 'Sem data final'}</strong></div>
                              <div className="row-actions"><button type="button" className="recurrence-action" disabled={busy} onClick={() => toggleRecurrence(item)} aria-label={`${item.active ? 'Pausar' : 'Reativar'} ${item.title}`}>{item.active ? 'Pausar' : 'Reativar'}</button><button type="button" className="danger" disabled={busy} onClick={() => removeRecurrence(item)} aria-label={`Excluir repetição ${item.title}`} title="Excluir repetição"><Trash2 /></button></div>
                            </article>
                          ))}
                      </div>
                      <p className="config-hint">A automação prepara as próximas 8 semanas. Ao pausar, ela remove apenas ocorrências de hoje em diante; atividades anteriores permanecem no histórico. Ao excluir, a série sai desta lista e as ocorrências de hoje em diante são removidas. Para alterar só uma data, edite a ocorrência em Atividades.</p>
                    </>
                  )}
                  {adminTab === 'retention' && <RetentionPanel key={managedTurma} turmaId={managedTurma} userId={user.uid} activityDates={managedActivities.map((activity) => activity.date)} />}
                  {adminTab === 'notices' && <NoticesAdminPanel key={managedTurma} turmaId={managedTurma} user={user} />}
                  {adminTab === 'chat' && <RepresentativesChat userId={user.uid} email={user.email ?? ''} profile={profile} />}
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
                      <RepresentativesPanel key={user.uid} />
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
                  {isSuperAdmin && adminTab === 'classes' && (
                    <>
                      <div className="admin-list-heading"><strong>Pedidos de agenda para novas turmas</strong></div>
                      <p className="representative-hint">Aprovar cria a agenda pública da turma. Não concede acesso de representante ao solicitante.</p>
                      <div className="admin-list">
                        {classRequests.length === 0 ? <p className="admin-empty">Nenhum pedido pendente.</p> : classRequests.map(item => (
                          <article key={item.id} className="admin-row compact representative-row">
                            <div className="avatar"><Calendar /></div>
                            <div className="admin-row-main"><strong>{item.className}</strong><span>{item.email}</span></div>
                            <div className="admin-row-meta"><span>Solicitado em</span><strong>{item.createdAt ? item.createdAt.toDate().toLocaleDateString('pt-BR') : '—'}</strong></div>
                            <div className="row-actions">
                              <button type="button" onClick={() => reviewClassRequest(item, true)} disabled={busy} aria-label={`Aprovar agenda de ${item.className}`} title="Aprovar"><Check /></button>
                              <button type="button" className="danger" onClick={() => reviewClassRequest(item, false)} disabled={busy} aria-label={`Recusar agenda de ${item.className}`} title="Recusar"><X /></button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                  {isSuperAdmin && adminTab === 'storage' && <StorageAdminPanel />}
                  {adminTab === 'site' && (
                    <>
                      <div className="admin-list-heading"><strong>Atualizações do sistema</strong></div>
                      <form className="system-update-editor" onSubmit={publishSystemUpdate}>
                        <p className="config-hint">Publique o que mudou na Agenda. A atualização ficará no histórico e aparecerá uma vez para cada visitante.</p>
                        <label>Título<input required maxLength={120} value={updateTitle} onChange={(event) => setUpdateTitle(event.target.value)} placeholder="Ex.: Enquetes para as turmas" /></label>
                        <label>O que mudou<textarea required rows={4} maxLength={2000} value={updateBody} onChange={(event) => setUpdateBody(event.target.value)} placeholder="Explique as novidades de forma simples para os alunos." /></label>
                        <label>Sugestão que inspirou a atualização (opcional)
                          <select value={updateFeedbackId} onChange={(event) => setUpdateFeedbackId(event.target.value)}>
                            <option value="">Sem sugestão vinculada</option>
                            {feedbackList.filter(isCreditEligible).map(item => <option key={item.id} value={item.id}>{item.publicCreditName} · {item.message.slice(0, 90)}</option>)}
                          </select>
                        </label>
                        {updateFeedbackId && <p className="config-hint">O nome escolhido e o texto original da sugestão aparecerão no aviso e no histórico. O e-mail continuará privado.</p>}
                        {!feedbackList.some(isCreditEligible) && <p className="config-hint">Sugestões aparecerão aqui quando a pessoa autorizar o crédito público em “Comentar melhoria”.</p>}
                        <div className="system-update-editor-actions"><span>Publicações permanecem no histórico.</span><button type="submit" className="primary-button compact" disabled={busy || !updateTitle.trim() || !updateBody.trim()}><History size={16} /> Publicar atualização</button></div>
                      </form>
                      {systemUpdates.length > 0 && <div className="system-update-admin-recent"><strong>Última publicação</strong>{systemUpdates.map((item) => <div key={item.id}><span>{item.title}</span><time>{item.publishedAt ? item.publishedAt.toDate().toLocaleDateString('pt-BR') : 'Publicando…'}</time></div>)}</div>}

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
                        <span className="config-hint">{pendingFeedbackCount} pendentes · {feedbackList.length - pendingFeedbackCount} concluídas</span>
                      </div>
                      <label className="feedback-filter">Mostrar sugestões<select value={feedbackFilter} onChange={event => setFeedbackFilter(event.target.value as FeedbackFilter)}><option value="pending">Pendentes</option><option value="completed">Concluídas</option><option value="all">Todas</option></select></label>
                      {conversation && <><button className="secondary-button" type="button" onClick={() => setConversation(null)}>Fechar conversa</button><FeedbackConversation key={conversation.id} feedback={feedbackList.find(item => item.id === conversation.id) ?? conversation} /></>}
                      <div className="admin-list">
                        {visibleFeedback.length === 0 ? <p className="admin-empty">{feedbackFilter === 'completed' ? 'Nenhuma sugestão concluída.' : feedbackFilter === 'pending' ? 'Nenhuma sugestão pendente.' : 'Nenhum comentário recebido.'}</p> : visibleFeedback.map((item) => (
                          <article key={item.id} className="admin-row compact">
                            <div className="avatar"><MessageSquarePlus /></div>
                            <div className="admin-row-main"><strong>{item.createdByEmail ?? 'Enviado antes da identificação obrigatória'}</strong><span className="feedback-message">{item.message}</span></div>
                            <div className="admin-row-meta"><span className={`feedback-state${isFeedbackCompleted(item) ? ' completed' : ''}`}>{isFeedbackCompleted(item) ? 'Concluída' : 'Pendente'}</span><span>{item.turmaId ?? 'Geral'}</span><strong>{item.createdAt ? item.createdAt.toDate().toLocaleDateString('pt-BR') : '—'}</strong>{isFeedbackCompleted(item) && item.completedAt && <span>Concluída em {item.completedAt.toDate().toLocaleDateString('pt-BR')}</span>}</div>
                            <div className="row-actions">
                              <button type="button" className="feedback-complete-action" disabled={busy} onClick={() => toggleFeedbackCompleted(item)} aria-label={`${isFeedbackCompleted(item) ? 'Reabrir' : 'Marcar como concluída'} sugestão: ${item.message}`}>{isFeedbackCompleted(item) ? 'Reabrir' : <><Check size={16} /> Concluir</>}</button>
                              {item.createdBy ? <button onClick={() => setConversation(item)} aria-label={`Conversar sobre a sugestão de ${item.createdByEmail}`}><MessagesSquare /></button> : <button className="danger" onClick={() => discardFeedback(item)} aria-label="Remover comentário"><Trash2 /></button>}
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
                      {classNames.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  )}
                </div>

                {(adminTab === 'activities' || adminTab === 'recurrences') && (
                  <button className="primary-button compact" onClick={startCreate}><Plus size={18} /> Nova atividade</button>
                )}

                {notice && <div className="notice"><Check size={17} /> {notice}</div>}
              </aside>
            </div>
          </div>
        )}

      {formOpen && authChecked && profile && user?.uid === auth.currentUser?.uid && createPortal(
          <div className="form-overlay activity-editor-overlay" role="dialog" aria-modal="true" aria-labelledby="activity-editor-title">
            <form className="activity-form activity-editor" onSubmit={saveActivity} aria-label={editing ? 'Editar atividade' : 'Adicionar atividade'}>
              <div className="form-title"><div><p className="eyebrow dark">ATIVIDADE</p><h3 id="activity-editor-title">{editing ? 'Editar atividade' : 'Adicionar atividade'}</h3></div><button type="button" className="icon-button" aria-label="Fechar formulário" onClick={() => quickEditActivity ? onClose() : setFormOpen(false)}><X /></button></div>
              <div className="activity-editor-scroll" tabIndex={0} role="region" aria-label="Campos da atividade">
              <div className="form-grid">
                <label className="wide">Título<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
                <label>Tipo<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as ActivityType })}>{ACTIVITY_TYPES.map((type) => <option value={type} key={type}>{ACTIVITY_TYPE_LABELS[type]}</option>)}</select></label>
                <label className="wide">Matéria<select value={form.subject ?? ''} onChange={(event) => setForm({ ...form, subject: event.target.value || null })}><option value="">Sem matéria específica</option>{SUBJECTS.map((subject) => <option value={subject} key={subject}>{subject}</option>)}</select></label>
                <label>Data<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
                {!editing && <label className="wide">Repetição<select value={!repeatWeekly ? 'none' : repeatCustom ? 'custom' : 'weekly'} onChange={event => { setRepeatWeekly(event.target.value !== 'none'); setRepeatCustom(event.target.value === 'custom'); setRepeatDays([new Date(`${form.date}T12:00:00`).getDay()]); setRepeatInterval(1); if (event.target.value !== 'none') { setIsGlobalForm(false); setSelectedFiles([]) } }}><option value="none">Não se repete</option><option value="weekly">Toda semana, no mesmo dia</option><option value="custom">Personalizada…</option></select></label>}
                {repeatWeekly && <>
                  <p className="config-hint wide">{repeatCustom ? 'A data acima inicia o período. A atividade aparecerá somente nos dias escolhidos, até a data final inclusive. As semanas são contadas de segunda a domingo.' : 'A data acima será a primeira ocorrência. A tarefa aparecerá no mesmo dia da semana nas semanas seguintes.'}</p>
                  {repeatCustom && <>
                    <fieldset className="repeat-days wide"><legend>Repetir nos dias</legend>{REPEAT_DAYS.map((day, index) => <label key={day}><input type="checkbox" checked={repeatDays.includes(index)} onChange={event => setRepeatDays(event.target.checked ? [...repeatDays, index] : repeatDays.filter(value => value !== index))} /><span>{day}</span></label>)}</fieldset>
                    <label>A cada quantas semanas?<input type="number" min={1} max={12} required value={repeatInterval} onChange={event => setRepeatInterval(Number(event.target.value))} /></label>
                  </>}
                  <label>{repeatCustom ? 'Data final' : 'Repetir até (opcional)'}<input required={repeatCustom} type="date" min={form.date} value={repeatEndDate} onChange={(event) => setRepeatEndDate(event.target.value)} /></label>
                </>}
                {!repeatWeekly && (!editing || isSuperAdmin) && <label className="toggle wide"><input type="checkbox" checked={isGlobalForm} onChange={(event) => setIsGlobalForm(event.target.checked)} /><span /> Evento geral (aparece em todas as turmas)</label>}
                {!repeatWeekly && isGlobalForm ? (
                  <p className="config-hint wide">Vai aparecer no calendário de todas as turmas, não só {isRepresentante ? 'da sua' : `de "${managedTurma}"`}.</p>
                ) : !repeatWeekly && editing && editing.turmaId === null && (
                  <p className="config-hint wide">Vai deixar de ser geral e passar a valer só para {isRepresentante ? 'a sua turma' : `"${managedTurma}"`}.</p>
                )}
                <label className="toggle wide"><input type="checkbox" checked={hasTime} onChange={(event) => { setHasTime(event.target.checked); if (!event.target.checked) setForm({ ...form, time: null }) }} /><span /> Tem horário definido</label>
                {hasTime && <label>Horário<input required type="time" value={form.time ?? ''} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label>}
                <label className="wide">Descrição<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Detalhes, capítulos, critérios de entrega…" /></label>
              </div>
              {ATTACHMENTS_ENABLED && !repeatWeekly && <section className="attachment-editor" aria-labelledby="attachment-editor-title">
                <div className="attachment-editor-heading"><Paperclip size={17} /><div><strong id="attachment-editor-title">Anexos</strong><span>Até 5 arquivos · 50 MB cada · PDF, Word, PowerPoint, ZIP ou imagem</span></div></div>
                {editorAttachments.map(item => <div className="attachment-editor-item" key={item.id}><span>{item.name} <small>{formatAttachmentSize(item.size)}</small></span><button type="button" disabled={busy} onClick={() => removeExistingAttachment(item.id)} aria-label={`Remover ${item.name}`}><Trash2 size={16} /></button></div>)}
                {selectedFiles.map((file, index) => <div className="attachment-editor-item pending" key={`${file.name}-${index}`}><span>{file.name} <small>{formatAttachmentSize(file.size)} · aguardando envio</small></span><button type="button" disabled={busy} onClick={() => setSelectedFiles(current => current.filter((_, position) => position !== index))} aria-label={`Remover ${file.name} da seleção`}><X size={16} /></button></div>)}
                {editorAttachments.length + selectedFiles.length < MAX_ATTACHMENTS && (!isGlobalForm || isSuperAdmin) && <label className="attachment-pick"><Plus size={16} /> Escolher arquivos<input type="file" multiple accept=".pdf,.docx,.pptx,.zip,.jpg,.jpeg,.png,.webp" onChange={event => { selectAttachments(event.target.files); event.target.value = '' }} /></label>}
                {isGlobalForm && !isSuperAdmin && <p>Arquivos em eventos gerais só podem ser incluídos por administradores.</p>}
              </section>}
              {saveError && <p className="form-error" role="alert">{saveError}</p>}
              </div>
              <div className="form-actions"><button type="button" className="secondary-button" onClick={() => quickEditActivity ? onClose() : setFormOpen(false)}>Cancelar</button><button className="primary-button compact" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : repeatWeekly ? 'Salvar repetição' : 'Salvar atividade'}</button></div>
            </form>
          </div>,
          document.body,
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
