import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock, Info, LoaderCircle, Megaphone, Pencil, Plus, StickyNote, Trash2, TriangleAlert, X } from 'lucide-react'
import type { User } from 'firebase/auth'
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import {
  NOTICE_BODY_MAX,
  NOTICE_MAX_DAYS,
  NOTICE_PREVIEW_COUNT,
  NOTICE_TITLE_MAX,
  NOTICE_TYPES,
  NOTICE_TYPE_LABELS,
  defaultNoticeExpiry,
  isNoticeActive,
  noticePurgeAt,
  sortNotices,
  validateNoticeDraft,
  type Notice,
  type NoticeType,
} from './notices'
import { useNow, useTurmaNotices } from './useNotices'

const TYPE_ICONS: Record<NoticeType, ReactNode> = {
  urgente: <TriangleAlert size={13} aria-hidden="true" />,
  aviso: <Megaphone size={13} aria-hidden="true" />,
  lembrete: <Info size={13} aria-hidden="true" />,
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function toDateInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function endOfDay(value: string): Date {
  return new Date(`${value}T23:59:00`)
}

// ——— Preview (hover/foco no desktop, toque no celular) ———

type PreviewState = { notice: Notice; left: number; top: number; width: number }

function useNoticePreview() {
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const timer = useRef<number | null>(null)

  const keepOpen = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }, [])

  const close = useCallback(() => {
    keepOpen()
    setPreview(null)
  }, [keepOpen])

  const closeSoon = useCallback(() => {
    keepOpen()
    timer.current = window.setTimeout(() => setPreview(null), 150)
  }, [keepOpen])

  const show = useCallback((element: HTMLElement, notice: Notice) => {
    keepOpen()
    const rect = element.getBoundingClientRect()
    const width = Math.min(340, window.innerWidth - 24)
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
    const below = rect.bottom + 8
    const top = below + 260 < window.innerHeight ? below : Math.max(12, rect.top - 8 - 260)
    setPreview({ notice, left, top, width })
  }, [keepOpen])

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  useEffect(() => {
    if (!preview) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (!target?.closest('[data-notice-id], .notice-preview')) close()
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && close()
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [preview, close])

  return { preview, show, keepOpen, close, closeSoon }
}

type PreviewApi = ReturnType<typeof useNoticePreview>

function NoticePreviewCard({ api }: { api: PreviewApi }) {
  const { preview } = api
  if (!preview) return null
  const { notice } = preview
  const expiresAt = notice.expiresAt?.toDate()
  return createPortal(
    <div
      id="notice-preview"
      className={`calendar-day-preview notice-preview notice-preview-${notice.type}`}
      role="tooltip"
      style={{ left: preview.left, top: preview.top, width: preview.width }}
      onMouseEnter={api.keepOpen}
      onMouseLeave={api.closeSoon}
    >
      <div className="notice-preview-head">
        <span className={`postit-tag postit-tag-${notice.type}`}>{TYPE_ICONS[notice.type]}{NOTICE_TYPE_LABELS[notice.type]}</span>
        <button type="button" className="notice-preview-close" onClick={api.close} aria-label="Fechar aviso"><X size={15} /></button>
      </div>
      <strong className="notice-preview-title">{notice.title}</strong>
      <p>{notice.body}</p>
      <span className="preview-author">
        {notice.authorEmail && <>Publicado por {notice.authorEmail}</>}
        {expiresAt && <>{notice.authorEmail ? ' · ' : ''}Vale até {formatDay(expiresAt)}</>}
      </span>
    </div>,
    document.body,
  )
}

function PostIt({ notice, api }: { notice: Notice; api: PreviewApi }) {
  const isOpen = api.preview?.notice.id === notice.id
  return (
    <button
      type="button"
      data-notice-id={notice.id}
      className={`postit postit-${notice.type}`}
      aria-describedby={isOpen ? 'notice-preview' : undefined}
      aria-label={`${NOTICE_TYPE_LABELS[notice.type]}: ${notice.title}`}
      onMouseEnter={(event) => api.show(event.currentTarget, notice)}
      onMouseLeave={api.closeSoon}
      onFocus={(event) => api.show(event.currentTarget, notice)}
      onBlur={api.closeSoon}
      onClick={(event) => api.show(event.currentTarget, notice)}
    >
      <span className={`postit-tag postit-tag-${notice.type}`}>{TYPE_ICONS[notice.type]}{NOTICE_TYPE_LABELS[notice.type]}</span>
      <strong className="postit-title">{notice.title}</strong>
      <span className="postit-body">{notice.body}</span>
    </button>
  )
}

// ——— Faixa da home ———

export function NoticeStrip({ notices, onOpenBoard }: { notices: Notice[]; onOpenBoard: () => void }) {
  const api = useNoticePreview()
  const shown = notices.slice(0, NOTICE_PREVIEW_COUNT)
  if (notices.length === 0) return null
  return (
    <section className="notice-strip" aria-label="Quadro de avisos da turma">
      <div className="notice-strip-list">
        {shown.map((notice) => <PostIt key={notice.id} notice={notice} api={api} />)}
        <button type="button" className="postit-more" onClick={onOpenBoard}>
          <StickyNote size={18} aria-hidden="true" />
          <strong>Ver todos</strong>
          <span>{notices.length} aviso{notices.length === 1 ? '' : 's'}</span>
        </button>
      </div>
      <NoticePreviewCard api={api} />
    </section>
  )
}

// ——— Formulário compartilhado (modal da home e aba do painel) ———

type NoticeFormProps = {
  turmaId: string
  user: User
  notice?: Notice
  onDone: () => void
}

export function NoticeForm({ turmaId, user, notice, onDone }: NoticeFormProps) {
  const originalExpiry = notice?.expiresAt?.toDate() ?? null
  const [type, setType] = useState<NoticeType>(notice?.type ?? 'aviso')
  const [title, setTitle] = useState(notice?.title ?? '')
  const [body, setBody] = useState(notice?.body ?? '')
  const [expiry, setExpiry] = useState(() => toDateInput(originalExpiry ?? defaultNoticeExpiry(new Date())))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const today = toDateInput(new Date())
  const maxExpiry = toDateInput(new Date(Date.now() + NOTICE_MAX_DAYS * 24 * 60 * 60 * 1000))

  async function submit(event: FormEvent) {
    event.preventDefault()
    const now = new Date()
    const expiryChanged = !originalExpiry || expiry !== toDateInput(originalExpiry)
    const expiresAt = expiryChanged || !originalExpiry ? endOfDay(expiry) : originalExpiry
    const draft = { title, body, type, expiresAt }
    const problem = validateNoticeDraft(draft, now, expiryChanged)
    if (problem) { setError(problem); return }
    setBusy(true)
    setError('')
    try {
      const fields = { title: title.trim(), body: body.trim(), type, expiresAt, purgeAt: noticePurgeAt(expiresAt), updatedAt: serverTimestamp() }
      if (notice) {
        await updateDoc(doc(db, 'boardNotices', notice.id), fields)
      } else {
        await addDoc(collection(db, 'boardNotices'), {
          ...fields, turmaId, createdBy: user.uid, authorEmail: user.email, createdAt: serverTimestamp(),
        })
      }
      onDone()
    } catch {
      setError('Não foi possível salvar o aviso. Confira sua permissão e tente novamente.')
      setBusy(false)
    }
  }

  return (
    <form className="notice-form poll-create" onSubmit={submit}>
      <h3>{notice ? 'Editar aviso' : `Novo aviso para ${turmaId}`}</h3>
      <fieldset className="notice-types">
        <legend>Tipo</legend>
        {NOTICE_TYPES.map((option) => (
          <label key={option} className={`notice-type notice-type-${option} ${type === option ? 'selected' : ''}`}>
            <input type="radio" name="notice-type" value={option} checked={type === option} onChange={() => setType(option)} />
            {TYPE_ICONS[option]}{NOTICE_TYPE_LABELS[option]}
          </label>
        ))}
      </fieldset>
      <label>Título
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={NOTICE_TITLE_MAX} placeholder="Ex.: Prova de Estatística na sexta" required />
      </label>
      <label>Texto
        <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={NOTICE_BODY_MAX} rows={4} placeholder="O que a turma precisa saber?" required />
        <small className="notice-counter">{body.length}/{NOTICE_BODY_MAX}</small>
      </label>
      <label>Vale até
        <input type="date" value={expiry} min={notice ? undefined : today} max={maxExpiry} onChange={(event) => setExpiry(event.target.value)} required />
        <small className="notice-counter">Depois dessa data o aviso some da agenda. O padrão é 30 dias.</small>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="notice-form-actions">
        <button type="submit" className="primary-button compact" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : notice ? 'Salvar alterações' : 'Publicar aviso'}</button>
        <button type="button" className="secondary-button" onClick={onDone} disabled={busy}>Cancelar</button>
      </div>
    </form>
  )
}

async function removeNotice(notice: Notice): Promise<string> {
  if (!window.confirm(`Apagar o aviso "${notice.title}"?`)) return ''
  try {
    await deleteDoc(doc(db, 'boardNotices', notice.id))
    return ''
  } catch {
    return 'Não foi possível apagar o aviso. Tente novamente.'
  }
}

// ——— Modal do quadro completo ———

type BoardDialogProps = {
  turmaId: string
  notices: Notice[]
  loading: boolean
  error: string
  user: User | null
  canManage: boolean
  onClose: () => void
}

export function NoticeBoardDialog({ turmaId, notices, loading, error, user, canManage, onClose }: BoardDialogProps) {
  const api = useNoticePreview()
  const [editing, setEditing] = useState<Notice | 'new' | null>(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && !editing && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, editing])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="polls-dialog notice-dialog" role="dialog" aria-modal="true" aria-labelledby="notices-title">
        <div className="dialog-header">
          <div><p className="eyebrow">QUADRO · {turmaId}</p><h2 id="notices-title">Quadro de avisos</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        <div className="polls-content">
          <div className="polls-intro">
            <p>Avisos dos representantes da turma. Os urgentes aparecem primeiro; depois, os mais recentes.</p>
            {canManage && user && !editing && <button type="button" className="secondary-button" onClick={() => setEditing('new')}><Plus size={16} /> Novo aviso</button>}
          </div>

          {canManage && user && editing && (
            <NoticeForm key={editing === 'new' ? 'new' : editing.id} turmaId={turmaId} user={user} notice={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
          )}

          {actionError && <p className="form-error" role="alert">{actionError}</p>}
          {loading ? <p className="polls-note"><LoaderCircle className="spin" size={16} /> Carregando avisos…</p>
            : error ? <p className="form-error" role="alert">{error}</p>
              : notices.length === 0 ? <div className="polls-empty"><StickyNote size={25} /><strong>Nenhum aviso por enquanto</strong><span>Quando um representante publicar um aviso, ele aparecerá aqui.</span></div>
                : (
                  <div className="notice-grid">
                    {notices.map((notice) => (
                      <div className="notice-item" key={notice.id}>
                        <PostIt notice={notice} api={api} />
                        {canManage && (
                          <div className="notice-item-actions">
                            <button type="button" onClick={() => { setActionError(''); setEditing(notice) }} aria-label={`Editar ${notice.title}`}><Pencil size={14} /> Editar</button>
                            <button type="button" className="danger" onClick={async () => setActionError(await removeNotice(notice))} aria-label={`Apagar ${notice.title}`}><Trash2 size={14} /> Apagar</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
        </div>
        <NoticePreviewCard api={api} />
      </section>
    </div>
  )
}

// ——— Aba do painel: lista completa, incluindo expirados ———

export function NoticesAdminPanel({ turmaId, user }: { turmaId: string; user: User }) {
  const { notices, loading, error } = useTurmaNotices(turmaId)
  const now = useNow()
  const [editing, setEditing] = useState<Notice | 'new' | null>(null)
  const [actionError, setActionError] = useState('')

  const { active, expired } = useMemo(() => {
    const sorted = sortNotices(notices)
    return {
      active: sorted.filter((notice) => isNoticeActive(notice, now)),
      expired: sorted.filter((notice) => !isNoticeActive(notice, now)),
    }
  }, [notices, now])

  const row = (notice: Notice, isExpired: boolean) => {
    const expiresAt = notice.expiresAt?.toDate()
    const purgeAt = notice.purgeAt?.toDate()
    return (
      <article key={notice.id} className={`admin-row compact notice-row ${isExpired ? 'is-expired' : ''}`}>
        <div className="admin-row-main">
          <strong><span className={`postit-tag postit-tag-${notice.type}`}>{TYPE_ICONS[notice.type]}{NOTICE_TYPE_LABELS[notice.type]}</span> {notice.title}</strong>
          <span>{notice.body}</span>
          <span className="notice-row-meta">
            <Clock size={11} aria-hidden="true" />
            {isExpired ? 'Expirado' : 'Vale até'} {expiresAt ? formatDay(expiresAt) : '—'}
            {isExpired && purgeAt ? ` · será apagado em ${formatDay(purgeAt)}` : ''}
            {notice.authorEmail ? ` · ${notice.authorEmail}` : ''}
          </span>
        </div>
        <div className="row-actions">
          <button type="button" onClick={() => { setActionError(''); setEditing(notice) }} aria-label={`Editar ${notice.title}`}><Pencil /></button>
          <button type="button" className="danger" onClick={async () => setActionError(await removeNotice(notice))} aria-label={`Apagar ${notice.title}`}><Trash2 /></button>
        </div>
      </article>
    )
  }

  return (
    <div className="notices-admin">
      <div className="admin-list-heading">
        <strong>Quadro de avisos de {turmaId}</strong>
        {!editing && <button type="button" className="secondary-button" onClick={() => setEditing('new')}><Plus size={16} /> Novo aviso</button>}
      </div>
      {editing && <NoticeForm key={editing === 'new' ? 'new' : editing.id} turmaId={turmaId} user={user} notice={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      {loading ? <p className="admin-empty"><LoaderCircle className="spin" size={15} /> Carregando avisos…</p>
        : error ? <p className="form-error" role="alert">{error}</p>
          : (
            <>
              <div className="admin-list">
                {active.length === 0 ? <p className="admin-empty">Nenhum aviso ativo.</p> : active.map((notice) => row(notice, false))}
              </div>
              {expired.length > 0 && (
                <>
                  <div className="admin-list-heading"><strong>Expirados</strong><span className="config-hint" style={{ margin: 0 }}>Somem da agenda; são apagados 30 dias depois de expirar</span></div>
                  <div className="admin-list">{expired.map((notice) => row(notice, true))}</div>
                </>
              )}
            </>
          )}
    </div>
  )
}
