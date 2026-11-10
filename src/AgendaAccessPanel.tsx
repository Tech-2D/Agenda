import { useEffect, useState } from 'react'
import { BarChart3, Globe, RefreshCw, Users } from 'lucide-react'
import type { User } from 'firebase/auth'
import { SQL_BASE } from './dataBackend'
import { auth } from './firebase'

type Counts = { authenticated: number; anonymous: number; accounts: number }
type Statistics = { today: string; total: Counts; daily: (Counts & { date: string })[] }
const number = new Intl.NumberFormat('pt-BR')
const count = (value: Counts) => value.authenticated + value.anonymous
const labelDate = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

export function AgendaAccessPanel({ user }: { user: User }) {
  const [days, setDays] = useState(7)
  const [revision, refresh] = useState(0)
  const [result, setResult] = useState<Statistics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    setError('')

    async function load() {
      const token = await user.getIdToken()
      if (controller.signal.aborted || auth.currentUser?.uid !== user.uid) return
      const response = await fetch(SQL_BASE + '/api/admin/agenda-access?days=' + days, {
        headers: { Authorization: 'Bearer ' + token },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        redirect: 'error',
        cache: 'no-store',
      })
      if (!response.ok) {
        if (controller.signal.aborted || auth.currentUser?.uid !== user.uid) return
        if (response.status === 401) setError('Entre novamente para consultar as estatísticas.')
        else if (response.status === 403) setError('Esta conta não tem acesso às estatísticas.')
        else setError('Não foi possível carregar as estatísticas. Tente atualizar.')
        return
      }
      const data: Statistics = await response.json()
      if (!controller.signal.aborted && auth.currentUser?.uid === user.uid) setResult(data)
    }
    void load().catch(() => {
      if (!controller.signal.aborted && auth.currentUser?.uid === user.uid) {
        setError('Não foi possível carregar as estatísticas. Tente atualizar.')
      }
    })
    return () => controller.abort()
  }, [user, days, revision])

  const maximum = Math.max(1, ...(result?.daily.map(count) ?? []))
  const today = result?.daily.find(row => row.date === result.today)
  return (
    <section className="storage-admin agenda-access" aria-labelledby="agenda-access-heading">
      <div className="storage-admin-heading">
        <div>
          <h3 id="agenda-access-heading">Estatísticas de acesso</h3>
          <p>Aberturas da Agenda, incluindo links diretos de atividades. Datas no horário de Brasília.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => refresh(n => n + 1)}><RefreshCw size={16} /> Atualizar</button>
      </div>
      <label className="agenda-access-range">Período
        <select value={days} onChange={event => setDays(Number(event.target.value))}>
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
        </select>
      </label>
      {error ? <p role="alert">{error}</p> : !result ? <p role="status">Carregando estatísticas…</p> : <>
        <div className="storage-admin-stats">
          <div className="storage-admin-stat"><BarChart3 size={18} /><span>Acessos no período</span><strong>{number.format(count(result.total))}</strong><small>{number.format(today ? count(today) : 0)} hoje</small></div>
          <div className="storage-admin-stat"><Users size={18} /><span>Contas distintas</span><strong>{number.format(result.total.accounts)}</strong><small>{number.format(result.total.authenticated)} acessos com login</small></div>
          <div className="storage-admin-stat"><Globe size={18} /><span>Acessos anônimos</span><strong>{number.format(result.total.anonymous)}</strong></div>
        </div>
        {result.daily.length ? <table className="agenda-access-table">
          <caption>Acessos por dia</caption>
          <thead><tr><th scope="col">Dia</th><th scope="col">Com login</th><th scope="col">Anônimos</th><th scope="col">Total</th></tr></thead>
          <tbody>{result.daily.map(row => <tr key={row.date}>
            <th scope="row"><time dateTime={row.date}>{labelDate(row.date)}</time></th>
            <td>{number.format(row.authenticated)}</td>
            <td>{number.format(row.anonymous)}</td>
            <td className="agenda-access-total">{number.format(count(row))}<span aria-hidden="true" style={{ width: `${count(row) / maximum * 100}%` }} /></td>
          </tr>)}</tbody>
        </table> : <p className="admin-empty">Ainda não há acessos registrados neste período.</p>}
      </>}
      <p className="storage-admin-note">A contagem agrupa aberturas repetidas pela mesma conta ou rede em intervalos de 30 minutos. Várias pessoas podem compartilhar uma rede.</p>
    </section>
  )
}
