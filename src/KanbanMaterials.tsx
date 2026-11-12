import { useEffect, useState } from 'react'
import { CalendarDays, Download, FileText, Link2, Paperclip, Trash2, Upload, X } from 'lucide-react'
import { formatAttachmentSize, validateAttachment } from './attachments'
import { auth } from './firebase'
import { SQL_BASE, SQL_ENABLED } from './dataBackend'
import type { Activity } from './types'

type FileTarget = { scope: 'personal' | 'shared'; board: string; task: string }
type StudyFile = { id: string; name: string; size: number }
const accept = '.pdf,.docx,.pptx,.zip,.jpg,.jpeg,.png,.webp'
const maxFiles = 5

async function requestFile(target: FileTarget, method = 'GET', file?: StudyFile, upload?: File, signal?: AbortSignal) {
  const account = auth.currentUser
  if (!account) throw Error('Entre na sua conta para acessar os arquivos.')
  const token = await account.getIdToken()
  if (account !== auth.currentUser) throw Error('Sua conta mudou. Abra a tarefa novamente.')
  const url = new URL('/api/kanban/files', SQL_BASE)
  for (const [key, value] of Object.entries(target)) url.searchParams.set(key, value)
  if (file) url.searchParams.set('file', file.id)
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(upload ? { 'Content-Type': 'application/octet-stream', 'X-Kanban-File-Name': encodeURIComponent(upload.name) } : {}),
    },
    body: upload,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000),
  })
  if (account !== auth.currentUser) throw Error('Sua conta mudou. Abra a tarefa novamente.')
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw Error(data.message || 'Não foi possível acessar os arquivos. Tente novamente.')
  }
  return response
}

export function KanbanFiles({scope, board, task}: FileTarget) {
  const [files, setFiles] = useState<StudyFile[]>([])
  const [loading, setLoading] = useState(true)
  const [operation, setOperation] = useState('')
  const busy = Boolean(operation)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    if (!SQL_ENABLED) return
    const controller = new AbortController()
    void requestFile({scope, board, task}, 'GET', undefined, undefined, controller.signal)
      .then(response => response.json())
      .then(data => { if (!controller.signal.aborted) setFiles(data.files) })
      .catch(error => { if (!controller.signal.aborted) setError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [scope, board, task, reload])
  if (!SQL_ENABLED) return null

  async function upload(file: File) {
    validateAttachment(file)
    if (file.size > 10 * 1024 * 1024) throw Error('Cada arquivo pode ter até 10 MB.')
    const response = await requestFile({scope, board, task}, 'POST', undefined, file)
    const result = await response.json() as {file: StudyFile}
    setFiles(list => [...list, result.file])
  }
  async function download(file: StudyFile) {
    const account = auth.currentUser
    const response = await requestFile({scope, board, task}, 'GET', file)
    const blob = await response.blob()
    if (account !== auth.currentUser) throw Error('Sua conta mudou. Abra a tarefa novamente.')
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.name
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function remove(file: StudyFile) {
    if (!window.confirm('Remover o arquivo “' + file.name + '” deste cartão?')) return
    await requestFile({scope, board, task}, 'DELETE', file)
    setFiles(list => list.filter(item => item.id !== file.id))
  }
  async function perform(message: string, action: () => Promise<void>) {
    setOperation(message)
    setError('')
    try { await action() }
    catch (error) { setError(error instanceof Error ? error.message : 'Tente novamente.') }
    finally { setOperation('') }
  }
  return <div className="kb-material-group kb-study-files">
    <div className="kb-study-heading">
      <h4><Paperclip size={17} aria-hidden="true"/> Arquivos de estudo</h4>
      {!loading && <span className="kb-study-count">{files.length} de {maxFiles} arquivos</span>}
    </div>
    <small>{scope === 'shared' ? 'Disponíveis para os participantes do quadro.' : 'Disponíveis apenas para você.'}</small>
    {files.length > 0 && <ul className="kb-material-list kb-study-list">{files.map(file => <li key={file.id}>
      <div className="kb-study-file">
        <FileText size={18} aria-hidden="true"/>
        <div><strong>{file.name}</strong><small>{formatAttachmentSize(file.size)}</small></div>
      </div>
      <button type="button" className="kb-icon" aria-label={'Baixar ' + file.name} disabled={busy} onClick={() => void perform('Preparando o download de ' + file.name + '…', () => download(file))}><Download size={16}/></button>
      <button type="button" className="kb-icon" aria-label={'Remover ' + file.name} disabled={busy} onClick={() => void perform('Removendo ' + file.name + '…', () => remove(file))}><Trash2 size={16}/></button>
    </li>)}</ul>}
    <div className="kb-study-upload">
      <div className="kb-study-formats" id="kb-study-formats">
        <strong>PDF, Word, PowerPoint, ZIP ou imagem</strong>
        <small>Até 10 MB por arquivo · 100 MB por quadro</small>
      </div>
      <label className="kb-study-picker secondary-button">
        <Upload size={16} aria-hidden="true"/> Escolher arquivo
        <input type="file" accept={accept} aria-describedby="kb-study-formats" disabled={busy || loading || files.length >= maxFiles} onChange={event => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void perform('Enviando ' + file.name + '…', () => upload(file))
        }}/>
      </label>
    </div>
    <div className="kb-study-status" role="status">
      {loading ? 'Carregando arquivos…' : operation || (files.length >= maxFiles ? 'Limite de arquivos atingido. Remova um para adicionar outro.' : '')}
    </div>
    {error && <p className="kb-error" role="alert">{error} <button type="button" className="kb-link" disabled={busy} onClick={() => {
      setError(''); setLoading(true); setReload(value => value + 1)
    }}>Atualizar arquivos</button></p>}
  </div>
}

export function KanbanActivityLinks({activities, ids, onChange}: {activities: Activity[]; ids: string[]; onChange: (ids: string[]) => void}) {
  const [selection, setSelection] = useState('')
  const candidates = activities.filter(activity => !ids.includes(activity.id) && /^[A-Za-z0-9_-]{1,128}$/.test(activity.id))
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title))
  const dateLabel = (date: string) => date.split('-').reverse().join('/')
  return <div className="kb-material-group">
    <h4><CalendarDays size={16}/> Atividades da Agenda</h4>
    <small>Vincule até 5 atividades da turma selecionada para abrir os detalhes pelo cartão.</small>
    {ids.length > 0 && <ul className="kb-material-list">{ids.map((id, index) => {
      const activity = activities.find(item => item.id === id)
      return <li key={id}><a href={'#atividade=' + encodeURIComponent(id)} target="_blank" rel="noopener noreferrer">
        <Link2 size={15}/>{activity?.title || 'Abrir atividade ' + (index + 1)}
      </a><button type="button" className="kb-icon" aria-label={'Remover vínculo ' + (activity?.title || index + 1)} onClick={() => onChange(ids.filter(item => item !== id))}><X size={16}/></button></li>
    })}</ul>}
    <div className="kb-material-select">
      <label>Atividade<select value={selection} disabled={ids.length >= 5} onChange={event => setSelection(event.target.value)}>
        <option value="">{candidates.length ? 'Selecione uma atividade' : 'Nenhuma atividade disponível para vincular'}</option>
        {candidates.map(activity => <option key={activity.id} value={activity.id}>{dateLabel(activity.date)} · {activity.title}</option>)}
      </select></label>
      <button type="button" className="secondary-button" disabled={!selection || ids.length >= 5 || !candidates.some(item => item.id === selection)} onClick={() => {
        onChange([...ids, selection]); setSelection('')
      }}><Link2 size={16}/> Vincular</button>
    </div>
  </div>
}
