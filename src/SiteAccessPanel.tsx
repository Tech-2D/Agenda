import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { User } from 'firebase/auth'
import { SQL_BASE } from './dataBackend'
import { auth } from './firebase'
import './siteAccess.css'

type Counts = { authenticated: number; anonymous: number; accounts: number }
type Site = { total: Counts; daily: (Counts & { date: string })[] }
type RecentAccount = { uid: string; email: string | null; lastSeen: string }
const siteLabels = { agenda: 'Agenda', professores: 'Cadê o professor?', pegaki: 'Pegaki' }
type SiteId = keyof typeof siteLabels
const siteIds = Object.keys(siteLabels) as SiteId[]

type Statistics = {
  today: string
  professorSince: string | null
  pegakiSince?: string | null
  sites: Record<'agenda' | 'professores', Site> & { pegaki?: Site }
  recent: RecentAccount[]
  pegakiRecent?: RecentAccount[]
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

  const daily = new Map(siteIds.map(site => [site, new Map(result?.sites[site]?.daily.map(row => [row.date, row]))]))
  const dates = [...new Set([...daily.values()].flatMap(rows => [...rows.keys()]))].sort().reverse()
  const hasCoverage = (site: SiteId, date: string) => {
    if (site === 'pegaki') return result?.pegakiSince && date >= result.pegakiSince
    if (site === 'professores') return result?.professorSince && date >= result.professorSince
    return !result?.professorSince || date >= result.professorSince
  }

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
          ? 'O comparativo entre Agenda e Cadê o professor começa no primeiro registro do Cadê o professor (' + labelDate(result.professorSince) + ').'
          : 'O Cadê o professor ainda não tem acessos registrados. A Agenda mostra seu histórico no período.'}</p>
        {result.sites.pegaki && <p className="site-access-note">{result.pegakiSince
          ? 'O Pegaki tem registros desde ' + labelDate(result.pegakiSince) + ' e mostra seu histórico no período escolhido.'
          : 'O Pegaki ainda não tem acessos registrados.'}</p>}
        <div className="site-access-summary">
          {siteIds.map(site => {
            const stats = result.sites[site]
            if (!stats) return null
            const { total, daily } = stats
            return (
              <div className="site-access-card" key={site}>
                <h4>{siteLabels[site]}</h4>
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
          <thead><tr><th scope="col">Dia</th>{siteIds.filter(site => result.sites[site]).map(site => <th key={site} scope="col">{siteLabels[site]}</th>)}</tr></thead>
          <tbody>{dates.map(date => <tr key={date}>
            <th scope="row"><time dateTime={date}>{labelDate(date)}</time></th>
            {siteIds.filter(site => result.sites[site]).map(site => (
              <td key={site}>{hasCoverage(site, date) ? number.format(count(daily.get(site)?.get(date))) : '—'}</td>
            ))}
          </tr>)}</tbody>
        </table>}
        <RecentAccounts title="Contas que acessaram o Cadê o professor" accounts={result.recent} />
        {result.pegakiRecent && <RecentAccounts title="Contas que acessaram o Pegaki" accounts={result.pegakiRecent} />}
      </>}
      <p className="site-access-note">A contagem agrupa aberturas pela mesma conta ou rede em intervalos de 30 minutos por site. Várias pessoas podem compartilhar uma rede. Datas e horários seguem Brasília.</p>
    </section>
  )
}

function RecentAccounts({ title, accounts }: { title: string; accounts: RecentAccount[] }) {
  return (
    <details className="site-access-recent">
      <summary>{title}</summary>
      {accounts.length ? <ul>
        {accounts.map(({ uid, email, lastSeen }) => (
          <li key={uid}><span>{email || uid}</span><time dateTime={lastSeen}>{localTime.format(new Date(lastSeen))}</time></li>
        ))}
      </ul> : <p className="site-access-note">Nenhum acesso com login neste período.</p>}
      {accounts.length === 50 && <p className="site-access-note">Mostrando as 50 contas com acesso mais recente.</p>}
    </details>
  )
}
