import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import type { User } from 'firebase/auth'
import type { Grades } from '../components/SubjectRow'
import type { Year } from '../data/subjects'
import type { Modes } from './grades'
import { notebookRequest, NotebookError } from './notebook'

type Draft = { grades: Record<string, Grades>; modes: Modes }
type PendingDraft = { version: number; draft: Draft }
const serialize = (draft: Draft) => JSON.stringify(draft)
const empty = (): Draft => ({ grades: {}, modes: { s1: 'notas', s2: 'notas' } })

function localDraft(year: Year): Draft {
  try {
    const legacy = JSON.parse(localStorage.getItem('aprovae:mode') || 'null')
    return {
      grades: JSON.parse(localStorage.getItem(`aprovae:v4:grades:${year}`) || '{}'),
      modes: JSON.parse(localStorage.getItem('aprovae:modes') || 'null') || { s1: legacy === 'media' ? 'media' : 'notas', s2: legacy === 'media' ? 'media' : 'notas' },
    }
  } catch { return empty() }
}

function readPending(key: string): PendingDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null')
    if (!Number.isInteger(value?.version) || value.version < 0 || !value.draft?.grades ||
      !['notas', 'media'].includes(value.draft.modes?.s1) || !['notas', 'media'].includes(value.draft.modes?.s2)) return null
    return value
  } catch { return null }
}

export function useNotebook(user: User | null, year: Year, academicYear: number) {
  const pendingKey = `pegaki:pending:${user?.uid}:${academicYear}:${year}`
  const [draft, setDraft] = useState<Draft>(() => user ? empty() : localDraft(year))
  const [saved, setSaved] = useState(() => serialize(draft))
  const [loading, setLoading] = useState(Boolean(user))
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(!user)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [revision, reload] = useState(0)
  const version = useRef(0)
  const latest = useRef(draft)
  const confirmed = useRef(saved)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const alive = useRef(false)
  const flush = useRef<() => Promise<boolean>>(async () => false)
  latest.current = draft
  confirmed.current = saved

  const persist = useCallback((next: Draft) => {
    try {
      if (user) localStorage.setItem(pendingKey, JSON.stringify({ version: version.current, draft: next }))
      else {
        localStorage.setItem(`aprovae:v4:grades:${year}`, JSON.stringify(next.grades))
        localStorage.setItem('aprovae:modes', JSON.stringify(next.modes))
      }
    } catch { /* Automatic network saves remain available when browser storage is blocked. */ }
  }, [user, pendingKey, year])

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    setReady(false)
    setError('')
    setConflict(false)
    void notebookRequest(user, academicYear, year).then(notebook => {
      if (!active) return
      const remote = notebook ? { grades: notebook.grades, modes: notebook.modes } : empty()
      const pending = readPending(pendingKey)
      version.current = notebook?.version ?? 0
      const recovering = pending && serialize(pending.draft) !== serialize(remote)
      const next = recovering ? pending.draft : remote
      if (recovering && pending.version !== version.current) {
        setConflict(true)
        setError('Há um rascunho neste navegador e notas alteradas em outro acesso. Recarregue as notas da conta para usar a versão salva.')
      }
      latest.current = next
      confirmed.current = serialize(remote)
      setDraft(next)
      setSaved(serialize(remote))
      setReady(true)
    }).catch(error => {
      if (active) setError(error instanceof Error ? error.message : 'Não foi possível carregar as notas.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user, academicYear, year, pendingKey, revision])

  const dirty = Boolean(user) && serialize(draft) !== saved

  const save = useCallback((): Promise<boolean> => {
    if (inFlight.current) return inFlight.current
    if (!user || !ready || loading || conflict) return Promise.resolve(false)
    const snapshot = latest.current
    const content = serialize(snapshot)
    if (content === confirmed.current) return Promise.resolve(true)
    persist(snapshot)
    if (alive.current) {
      setSaving(true)
      setError('')
    }
    let completed = false
    const request = (async () => {
      try {
        const result = await notebookRequest(user, academicYear, year, { ...snapshot, version: version.current })
        if (!result) throw new Error('Não foi possível confirmar o salvamento.')
        version.current = result.version
        confirmed.current = content
        // Keep edits made during this request with the newly confirmed version.
        const pending = readPending(pendingKey)
        const current = serialize(latest.current) === content ? pending?.draft ?? snapshot : latest.current
        if (serialize(current) !== content) persist(current)
        else {
          try { localStorage.removeItem(pendingKey) } catch { /* Browser storage may be unavailable. */ }
        }
        if (alive.current) setSaved(content)
        completed = true
        return true
      } catch (error) {
        if (alive.current) {
          const collided = error instanceof NotebookError && error.status === 409
          setConflict(collided)
          setError(collided ? 'As notas mudaram em outro acesso. Seu rascunho foi mantido neste navegador.' :
            'Não foi possível salvar agora. Seu rascunho será reenviado quando a conexão voltar.')
        }
        return false
      } finally {
        inFlight.current = null
        if (alive.current) setSaving(false)
        else if (completed && serialize(latest.current) !== confirmed.current) void flush.current()
      }
    })()
    inFlight.current = request
    return request
  }, [user, ready, loading, conflict, persist, academicYear, year, pendingKey])
  flush.current = save

  useEffect(() => {
    alive.current = true
    const hide = () => { if (document.visibilityState === 'hidden') void flush.current() }
    const leave = () => { void flush.current() }
    const online = () => { void flush.current() }
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', leave)
    window.addEventListener('online', online)
    return () => {
      void flush.current()
      alive.current = false
      document.removeEventListener('visibilitychange', hide)
      window.removeEventListener('pagehide', leave)
      window.removeEventListener('online', online)
    }
  }, [])

  useEffect(() => {
    if (!dirty || !ready || saving || conflict || loading) return
    const timer = window.setTimeout(() => { void save() }, error ? 10000 : 1200)
    return () => window.clearTimeout(timer)
  }, [dirty, ready, saving, conflict, loading, draft, error, save])

  function change(update: (current: Draft) => Draft) {
    if (user && !ready) return
    const next = update(latest.current)
    latest.current = next
    persist(next)
    setDraft(next)
  }

  async function saveBeforeLeaving() {
    // An earlier in-flight request may contain fewer edits than the current draft.
    if (inFlight.current && !await inFlight.current) return false
    return save()
  }

  return {
    grades: draft.grades, modes: draft.modes,
    setGrades: (value: SetStateAction<Record<string, Grades>>) => change(current => ({ ...current, grades: typeof value === 'function' ? value(current.grades) : value })),
    setModes: (value: SetStateAction<Modes>) => change(current => ({ ...current, modes: typeof value === 'function' ? value(current.modes) : value })),
    dirty, loading, ready, saving, error, conflict, save: saveBeforeLeaving,
    reload: () => {
      try { localStorage.removeItem(pendingKey) } catch { /* Reload can still read the account. */ }
      reload(value => value + 1)
    },
    canImport: Boolean(user) && ready && !error && !dirty && Object.keys(draft.grades).length === 0 && Object.keys(localDraft(year).grades).length > 0,
    importLocal: () => change(() => localDraft(year)),
  }
}
