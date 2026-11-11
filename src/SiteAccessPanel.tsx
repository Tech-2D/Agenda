import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { User } from 'firebase/auth'
import { SQL_BASE } from './dataBackend'
import { auth } from './firebase'
import './siteAccess.css'

type Counts = { authenticated: number; anonymous: number; accounts: number }
type Site = { total: Counts; daily: (Counts & { date: string })[] }
type Statistics = {
  today: string
  professorSince: string | null
  sites: { agenda: Site; professores: Site }
  recent: { uid: string; email: string | null; lastSeen: string }[]
}

const number = new Intl.NumberFormat('pt-BR')
const localTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
const count = (value?: Counts) => value ? value.authenticated + value.anonymous : 0
const labelDate = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

export function SiteAccessPanel({ user }: { user: User }) {
  const [days, setDays] = useState(7)
  const [revision, refresh] = useState(0)
  const [result, setResult] = useState<Statistics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const isCurrent = () => !controller.signal.aborted && auth.currentUser?.uid === user.uid
    setResult(null)
    setError('')

    async function load() {
      const token = await user.getIdToken()
      if (!isCurrent()) return
      const response = await fetch(SQL_BASE + '/api/admin/site-access?days=' + days, {
        headers: { Authorization: 'Bearer ' + token },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        redirect: 'error',
        cache: 'no-store',
      })
      if (!isCurrent()) return
      if (response.status === 401) return setError('Entre novamente para consultar os acessos.')
      if (response.status === 403) return setError('Esta conta não tem acesso às estatísticas.')
      if (!response.ok) throw new Error('ACCESS_STATS_UNAVAILABLE')
      const data: Statistics = await response.json()
      if (isCurrent()) setResult(data)
    }
    void load().catch(() => {
      if (isCurrent()) setError('Não foi possível carregar os acessos. Tente atualizar.')
    })
    return () => controller.abort()
  }, [user, days, revision])

  const agenda = new Map(result?.sites.agenda.daily.map(row => [row.date, row]))
  const professores = new Map(result?.sites.professores.daily.map(row => [row.date, row]))
  const dates = [...new Set([...agenda.keys(), ...professores.keys()])].sort().reverse()

  return (
    <section className="site-access" aria-labelledby="site-access-heading">
      <div className="site-access-toolbar">
        <h3 id="site-access-heading">Acessos aos sites</h3>
        <label>Período
          <select value={days} onChange={event => setDays(Number(event.target.value))}>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
          </select>
        </label>
        <button type="button" className="secondary-button" onClick={() => refresh(n => n + 1)}><RefreshCw size={16} /> Atualizar</button>
      </div>
      {error ? <p role="alert">{error}</p> : !result ? <p role="status">Carregando acessos…</p> : <>
        <p className="site-access-note">{result.professorSince
          ? 'O comparativo usa os dias do período escolhido a partir do primeiro registro do Cadê o professor (' + labelDate(result.professorSince) + ').'
          : 'O Cadê o professor ainda não tem acessos registrados. A Agenda mostra seu histórico no período.'}</p>
        <div className="site-access-summary">
          {([['Agenda', 'agenda'], ['Cadê o professor?', 'professores']] as const).map(([title, site]) => {
            const { total, daily } = result.sites[site]
            return (
              <div className="site-access-card" key={site}>
                <h4>{title}</h4>
                <strong>{number.format(count(total))} acessos</strong>
                <small>{number.format(count(daily.find(row => row.date === result.today)))} hoje</small>
                <small>{number.format(total.authenticated)} com login · {number.format(total.anonymous)} anônimos</small>
                <small>{number.format(total.accounts)} contas distintas</small>
              </div>
            )
          })}
        </div>
        {dates.length > 0 && <table className="site-access-table">
          <caption>Acessos por dia</caption>
          <thead><tr><th scope="col">Dia</th><th scope="col">Agenda</th><th scope="col">Cadê o professor?</th></tr></thead>
          <tbody>{dates.map(date => <tr key={date}>
            <th scope="row"><time dateTime={date}>{labelDate(date)}</time></th>
            <td>{number.format(count(agenda.get(date)))}</td>
            <td>{result.professorSince ? number.format(count(professores.get(date))) : '—'}</td>
          </tr>)}</tbody>
        </table>}
        <details className="site-access-recent">
          <summary>Contas que acessaram o Cadê o professor</summary>
          {result.recent.length ? <ul>
            {result.recent.map(({ uid, email, lastSeen }) => (
              <li key={uid}><span>{email || uid}</span><time dateTime={lastSeen}>{localTime.format(new Date(lastSeen))}</time></li>
            ))}
          </ul> : <p className="site-access-note">Nenhum acesso com login neste período.</p>}
          {result.recent.length === 50 && <p className="site-access-note">Mostrando as 50 contas com acesso mais recente.</p>}
        </details>
      </>}
      <p className="site-access-note">A contagem agrupa aberturas pela mesma conta ou rede em intervalos de 30 minutos por site. Várias pessoas podem compartilhar uma rede. Datas e horários seguem Brasília.</p>
    </section>
  )
}
