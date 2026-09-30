import { useEffect, useState } from 'react'
import { Download, HardDrive, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react'
import { auth } from './firebase'

const API = import.meta.env.VITE_STORAGE_ADMIN_API_URL?.trim() || 'https://tech-2d-agenda-storage.onrender.com/api/storage-admin'

type Usage = { bucket: string; bytes: number; count: number; partial: boolean }
type StoredFile = { key: string; size: number; lastModified: string | null; managed: boolean }
type FilePage = { files: StoredFile[]; nextCursor: string | null }
type Overview = { usage: Usage; page: FilePage }

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3)
  return `${(bytes / 1024 ** unit).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${['B', 'KB', 'MB', 'GB'][unit]}`
}

async function request(action: string, extra: Record<string, unknown> = {}) {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Entre novamente como administrador.')
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...extra }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Não foi possível acessar o armazenamento.')
  return data
}

export function StorageAdminPanel() {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [files, setFiles] = useState<StoredFile[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [workingKey, setWorkingKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const { usage: summary, page } = await request('overview') as Overview
      setLoaded(true)
      setUsage(summary)
      setFiles(page.files)
      setNextCursor(page.nextCursor)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o armazenamento.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [])

  async function loadMore() {
    if (!nextCursor || loading) return
    setLoading(true)
    setError('')
    try {
      const page = await request('list', { cursor: nextCursor }) as FilePage
      setFiles(previous => [...previous, ...page.files])
      setNextCursor(page.nextCursor)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar mais arquivos.') }
    finally { setLoading(false) }
  }

  async function download(file: StoredFile) {
    setWorkingKey(file.key)
    setError('')
    try {
      const result = await request('download', { key: file.key }) as { url: string }
      window.location.assign(result.url)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível baixar o arquivo.') }
    finally { setWorkingKey(null) }
  }

  async function remove(file: StoredFile) {
    const name = file.key.split('/').at(-1) || file.key
    if (!window.confirm(`Excluir definitivamente “${name}” do R2? O anexo também sairá da atividade, se ainda estiver vinculado.`)) return
    setWorkingKey(file.key)
    setError('')
    setNotice('')
    try {
      await request('remove', { key: file.key })
      setNotice(`Arquivo “${name}” excluído.`)
      await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível excluir o arquivo.') }
    finally { setWorkingKey(null) }
  }

  return (
    <section className="storage-admin" aria-labelledby="storage-admin-title">
      <div className="storage-admin-heading">
        <div><span className="storage-admin-eyebrow">CLOUDFLARE R2</span><h3 id="storage-admin-title">Armazenamento da Agenda</h3><p>Confira o espaço usado e gerencie os anexos das atividades.</p></div>
        <button className="secondary-button" type="button" onClick={() => void refresh()} disabled={loading || !!workingKey}><RefreshCw size={16} /> Atualizar</button>
      </div>
      <div className="storage-admin-stats">
        <div className="storage-admin-stat"><HardDrive size={19} aria-hidden="true" /><span>Espaço ocupado</span><strong>{usage ? formatBytes(usage.bytes) : '—'}</strong></div>
        <div className="storage-admin-stat"><span>Arquivos no bucket</span><strong>{usage ? usage.count.toLocaleString('pt-BR') : '—'}</strong><small>{usage?.bucket ?? 'tech-2d-agenda'}</small></div>
      </div>
      {usage?.partial && <p className="storage-admin-note">O bucket tem mais de 20 mil arquivos. Os números acima são parciais; consulte o painel Cloudflare para o total.</p>}
      <p className="storage-admin-note">Espaço ocupado pelos objetos atuais, calculado ao atualizar. Não é a métrica de faturamento do R2.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="storage-admin-success" role="status">{notice}</p>}
      <div className="storage-admin-list-heading"><strong>Documentos</strong><span>{loaded ? `${files.length} carregado${files.length === 1 ? '' : 's'}` : 'Consulta indisponível'}</span></div>
      {loading && !files.length ? <p className="admin-empty"><LoaderCircle className="spin" size={18} /> Carregando arquivos…</p> : !loaded ? <p className="admin-empty">{error ? 'Não foi possível consultar os arquivos. Tente atualizar mais tarde.' : 'Aguardando consulta aos arquivos.'}</p> : files.length === 0 ? <p className="admin-empty">Nenhum arquivo encontrado no bucket.</p> : (
        <div className="storage-admin-list">
          {files.map(file => (
            <article className="storage-admin-file" key={file.key}>
              <div className="storage-admin-file-details"><strong title={file.key}>{file.key.split('/').at(-1)}</strong><span title={file.key}>{file.key}</span><small>{formatBytes(file.size)} · {file.lastModified ? new Date(file.lastModified).toLocaleDateString('pt-BR') : 'Data indisponível'}</small></div>
              <div className="storage-admin-file-actions">
                {file.managed ? <><button type="button" onClick={() => void download(file)} disabled={!!workingKey} aria-label={`Baixar ${file.key}`} title="Baixar"><Download size={17} /></button><button type="button" className="danger" onClick={() => void remove(file)} disabled={!!workingKey} aria-label={`Excluir ${file.key}`} title="Excluir"><Trash2 size={17} /></button></> : <span title="Este objeto não corresponde a um anexo da Agenda">Somente leitura</span>}
              </div>
            </article>
          ))}
        </div>
      )}
      {nextCursor && <button type="button" className="secondary-button storage-admin-more" onClick={() => void loadMore()} disabled={loading || !!workingKey}>{loading ? 'Carregando…' : 'Carregar mais arquivos'}</button>}
    </section>
  )
}
