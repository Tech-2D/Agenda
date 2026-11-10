import { useEffect, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { RefreshCw, ShieldBan } from 'lucide-react'
import { SQL_BASE } from './dataBackend'
import { auth } from './firebase'

type AgendaAccount = { uid: string; email: string | null; lastSeen: string | null; protected: boolean; emailBlocked: boolean; networkBlocked: boolean; hasNetwork: boolean }
type Block = { id: string; kind: 'email' | 'ip'; label: string; createdAt: string }
type UsersResult = { users: AgendaAccount[]; hasMore: boolean; blocks: Block[]; hasMoreBlocks: boolean }
type Kind = 'email' | 'ip' | 'recent-network'
type Change = { action: 'block'; kind: Kind; value: string } | { action: 'unblock'; id: string }
const endpoint = SQL_BASE + '/api/admin/agenda-users'
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

async function request(user: User, path: string, signal: AbortSignal, change?: Change) {
  const token = await user.getIdToken()
  if (auth.currentUser?.uid !== user.uid || signal.aborted) throw Error('Sua sessão mudou.')
  const response = await fetch(endpoint + path, {
    method: change ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, ...(change ? { 'Content-Type': 'application/json' } : {}) },
    ...(change ? { body: JSON.stringify(change) } : {}),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  })
  const result = await response.json().catch(() => null)
  if (auth.currentUser?.uid !== user.uid || signal.aborted) throw Error('Sua sessão mudou.')
  if (!response.ok) throw Error(result?.message || 'Não foi possível consultar a Agenda.')
  return result
}

export function AgendaUsersPanel({ user }: { user: User }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [blockOffset, setBlockOffset] = useState(0)
  const [revision, refresh] = useState(0)
  const [result, setResult] = useState<UsersResult | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<'email' | 'ip'>('email')
  const [target, setTarget] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    setError('')
    const params = new URLSearchParams({ q: query, offset: String(offset), blockOffset: String(blockOffset) })
    void request(user, '?' + params, controller.signal).then(data => setResult(data as UsersResult)).catch(cause => {
      if (!controller.signal.aborted && auth.currentUser?.uid === user.uid) setError(cause instanceof Error ? cause.message : 'Falha ao carregar usuários.')
    })
    return () => controller.abort()
  }, [user, query, offset, blockOffset, revision])

  async function changeAccess(change: Change) {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request(user, '', AbortSignal.timeout(15000), change)
      setNotice(change.action === 'block' ? 'Bloqueio registrado.' : 'Bloqueio removido.')
      setTarget('')
      setBlockOffset(0)
      refresh(n => n + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao alterar o acesso.')
    } finally {
      setBusy(false)
    }
  }

  function block(nextKind: Kind, value: string, label: string) {
    const explanation = nextKind === 'email' ? 'Bloquear o acesso com esse e-mail?' : 'Bloquear esta rede na Agenda? Outros usuários no mesmo IP também podem perder o acesso.'
    if (window.confirm(explanation + '\n\n' + label)) void changeAccess({ action: 'block', kind: nextKind, value })
  }

  function searchUsers(event: FormEvent) {
    event.preventDefault()
    setOffset(0)
    setQuery(search.trim())
  }

  return (
    <section className="storage-admin agenda-users" aria-labelledby="agenda-users-title">
      <div className="storage-admin-heading">
        <div><h3 id="agenda-users-title">Usuários e bloqueios</h3><p>Todos os usuários cadastrados. O último acesso mostra quando a conta abriu a Agenda, quando houver registro.</p></div>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => refresh(n => n + 1)}><RefreshCw size={16} /> Atualizar</button>
      </div>
      {notice && <p className="storage-admin-success" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <form className="agenda-users-form" onSubmit={searchUsers}>
        <label>Buscar conta<input type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={254} placeholder="E-mail ou UID" /></label>
        <button className="secondary-button" disabled={busy}>Buscar</button>
      </form>
      {!result && !error && <p role="status">Carregando usuários…</p>}
      {result && <>
        <div className="storage-admin-list">
          {result.users.length === 0 && <p className="admin-empty">Nenhuma conta encontrada.</p>}
          {result.users.map(item => (
            <article className="storage-admin-file" key={item.uid}>
              <div className="agenda-user-details">
                <strong>{item.email || 'Conta sem e-mail registrado'}</strong>
                <small>UID {item.uid}</small>
                <small>{item.lastSeen ? <>Último acesso <time dateTime={item.lastSeen}>{date.format(new Date(item.lastSeen))}</time></> : 'Sem acesso registrado na Agenda'}</small>
                {(item.emailBlocked || item.networkBlocked) && <small>{item.emailBlocked ? 'E-mail bloqueado' : 'Última rede bloqueada'}</small>}
              </div>
              {item.protected ? <small>Superadministrador</small> : <div className="agenda-user-actions">
                {item.email && !item.emailBlocked && <button type="button" className="secondary-button" disabled={busy} onClick={() => block('email', item.email!, item.email!)}>Bloquear e-mail</button>}
                {item.hasNetwork && !item.networkBlocked && <button type="button" className="secondary-button" disabled={busy} onClick={() => block('recent-network', item.uid, item.email || item.uid)}>Bloquear última rede</button>}
              </div>}
            </article>
          ))}
        </div>
        {(offset > 0 || result.hasMore) && <nav className="agenda-user-actions" aria-label="Páginas de usuários">
          <button type="button" className="secondary-button" disabled={offset === 0 || busy} onClick={() => setOffset(n => n - 50)}>Anterior</button>
          <button type="button" className="secondary-button" disabled={!result.hasMore || busy} onClick={() => setOffset(n => n + 50)}>Próxima</button>
        </nav>}
      </>}
      <section className="agenda-users-blocks" aria-labelledby="agenda-blocks-title">
        <h4 id="agenda-blocks-title">Bloqueios de acesso</h4>
        <form className="agenda-users-form" onSubmit={event => { event.preventDefault(); block(kind, target, target) }}>
          <label>Bloquear por<select value={kind} onChange={event => { setKind(event.target.value as typeof kind); setTarget('') }}>
            <option value="email">E-mail</option><option value="ip">Endereço IP</option>
          </select></label>
          <label>{kind === 'email' ? 'E-mail da conta' : 'Endereço IPv4 ou IPv6'}<input type={kind === 'email' ? 'email' : 'text'} value={target} onChange={event => setTarget(event.target.value)} maxLength={254} required /></label>
          <button className="secondary-button" disabled={busy || !target.trim()}><ShieldBan size={16} /> Bloquear</button>
        </form>
        <p className="storage-admin-note">O bloqueio por IP vale para a rede inteira. A lista usa um código em vez de mostrar o endereço.</p>
        {result && <div className="storage-admin-list">
          {result.blocks.length === 0 && <p className="admin-empty">Nenhum bloqueio nesta página.</p>}
          {result.blocks.map(item => <article className="storage-admin-file" key={item.id}>
            <div className="agenda-user-details"><strong>{item.label}</strong><small>{item.kind === 'ip' ? 'IP' : 'E-mail'} · {date.format(new Date(item.createdAt))}</small></div>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => {
              if (window.confirm('Remover o bloqueio de ' + item.label + '?')) void changeAccess({ action: 'unblock', id: item.id })
            }}>Desbloquear</button>
          </article>)}
        </div>}
        {result && (blockOffset > 0 || result.hasMoreBlocks) && <nav className="agenda-user-actions" aria-label="Páginas de bloqueios">
          <button type="button" className="secondary-button" disabled={blockOffset === 0 || busy} onClick={() => setBlockOffset(n => n - 50)}>Anterior</button>
          <button type="button" className="secondary-button" disabled={!result.hasMoreBlocks || busy} onClick={() => setBlockOffset(n => n + 50)}>Próxima</button>
        </nav>}
      </section>
    </section>
  )
}
