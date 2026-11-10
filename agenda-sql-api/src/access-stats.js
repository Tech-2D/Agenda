import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import { localDate } from './jobs.js'
import { assertAgendaAllowed, clientIp, recordRecentUser } from './agenda-moderation.js'

const halfHourMs = 30 * 60 * 1000
const retentionDays = 90
const noContent = () => new Response(null, { status: 204 })

export async function handleAccessStats(request, env, { connect, verify, reply, origin }, route, now = new Date()) {
  const record = route === 'record'
  if (request.method !== (record ? 'POST' : 'GET')) return reply({ message: 'Método não permitido.' }, 405)
  const url = new URL(request.url)
  const days = url.searchParams.get('days') ?? '7'
  const invalidStatsQuery = !['7', '30'].includes(days) || url.searchParams.size !== (url.searchParams.has('days') ? 1 : 0)
  if (record ? url.search : invalidStatsQuery) {
    return reply({ message: 'Confira os parâmetros da consulta.' }, 400)
  }
  if (record && !origin) return reply({ message: 'Origem obrigatória.' }, 403)
  if (env.MIGRATION_READY !== 'true' || env.APPLICATION_DATA_ENABLED !== 'true' || !env.AGENDA_ACCESS_HMAC_KEY || env.AGENDA_ACCESS_HMAC_KEY.length < 32) {
    return reply({ message: 'Estatísticas ainda indisponíveis.' }, 503)
  }
  if (record && env.APPLICATION_WRITES_ENABLED !== 'true') return noContent()
  if (record && request.body) {
    // Workers can present an empty POST as a stream instead of a null body.
    const reader = request.body.getReader()
    const first = await reader.read()
    if (!first.done) {
      void reader.cancel().catch(() => {})
      return reply({ message: 'O registro de acesso não recebe dados no corpo.' }, 400)
    }
  }

  const account = !record || request.headers.has('Authorization') ? await verify(request, env) : null
  const today = localDate(now)
  const ip = record ? clientIp(request) : null
  if (record && !account && (!ip || !isIP(ip))) return noContent()
  const db = await connect(env)
  try {
    if (record) {
      await assertAgendaAllowed(db, env, { account, ip })
      // Use the edge-supplied IP only to derive a key scoped to the local calendar day.
      const visitorKey = account?.uid ?? createHmac('sha256', env.AGENDA_ACCESS_HMAC_KEY).update(today + '|' + ip).digest('hex')
      await db.query(`INSERT INTO tech2d.agenda_access(day, half_hour, kind, visitor_key)
        SELECT $1, $2, $3, $4 FROM tech2d.migration_state
        WHERE id = true AND production_enabled AND application_seeded
        ON CONFLICT DO NOTHING`, [today, Math.floor(now.getTime() / halfHourMs), account ? 'account' : 'anonymous', visitorKey])
      await recordRecentUser(db, env, account, ip, now)
      return noContent()
    }

    const profile = (await db.query('SELECT data FROM tech2d.app_documents WHERE path = $1', ['admins/' + account.uid])).rows[0]?.data
    if (profile?.role !== 'superadmin') return reply({ message: 'Você não tem permissão para consultar estatísticas.' }, 403)

    const { rows } = await db.query(`SELECT day::text AS date,
        count(*) FILTER (WHERE kind = 'account') AS authenticated,
        count(*) FILTER (WHERE kind = 'anonymous') AS anonymous,
        count(DISTINCT visitor_key) FILTER (WHERE kind = 'account') AS accounts
      FROM tech2d.agenda_access WHERE day BETWEEN $1::date - ($2::int - 1) AND $1::date
      GROUP BY GROUPING SETS ((day), ()) ORDER BY day DESC NULLS FIRST`, [today, Number(days)])
    const counts = row => ({ authenticated: Number(row.authenticated), anonymous: Number(row.anonymous), accounts: Number(row.accounts) })
    const [total, ...daily] = rows
    return reply({ today, total: counts(total), daily: daily.map(row => ({ date: row.date, ...counts(row) })) })
  } finally {
    await db.end().catch(() => {})
  }
}

export async function pruneAgendaAccess(db, now = new Date()) {
  await db.query('DELETE FROM tech2d.agenda_access WHERE day < $1::date - ($2::int - 1)', [localDate(now), retentionDays])
}
