import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'

const enabled = env => env.AGENDA_MODERATION_ENABLED === 'true'
const emailValue = value => typeof value === 'string' ? value.trim().toLowerCase() : null
const validEmail = value => value && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const sharedCollections = new Set(['admins', 'userProfiles', 'schedules', 'notebookNotes'])
export const clientIp = request => request.headers.get('CF-Connecting-IP')

function networkKey(env, ip) {
  if (typeof ip !== 'string' || ip.includes('%') || !env.AGENDA_ACCESS_HMAC_KEY || env.AGENDA_ACCESS_HMAC_KEY.length < 32) return null
  const version = isIP(ip)
  if (!version) return null
  let canonical = version === 6 ? new URL('http://[' + ip + ']/').hostname.slice(1, -1) : ip
  const mapped = canonical.match(/^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/)
  if (mapped) {
    canonical = mapped.slice(1).flatMap(part => {
      const value = Number.parseInt(part, 16)
      return [value >> 8, value & 255]
    }).join('.')
  }
  return createHmac('sha256', env.AGENDA_ACCESS_HMAC_KEY).update('agenda-network|' + canonical).digest('hex')
}

async function isSuperadmin(db, uid) {
  const { rows } = await db.query('SELECT data->>\'role\' AS role FROM tech2d.app_documents WHERE path=$1', ['admins/' + uid])
  return rows[0]?.role === 'superadmin'
}

export function isAgendaDocumentRequest(input) {
  const paths = input.action === 'commit' && Array.isArray(input.commit?.writes)
    ? [...input.commit.writes, ...(Array.isArray(input.commit.reads) ? input.commit.reads : [])].map(write => write?.path)
    : [input.action === 'query' ? input.query?.path : input.path]
  return paths.some(path => typeof path === 'string' && !sharedCollections.has(path.split('/')[0]))
}

export async function assertAgendaAllowed(db, env, { account, ip }) {
  if (!enabled(env)) return
  const email = emailValue(account?.email)
  const network = networkKey(env, ip)
  if (!email && !network) return
  const { rows } = await db.query(`SELECT 1 FROM tech2d.agenda_blocks
    WHERE (kind='email' AND target=$1) OR (kind='ip' AND target=$2) LIMIT 1`, [email, network])
  if (rows.length && !(account?.uid && await isSuperadmin(db, account.uid))) {
    throw Object.assign(Error('Seu acesso à Agenda foi bloqueado. Se precisar de ajuda, fale com a administração.'), { status: 403, code: 'agenda-access-blocked' })
  }
}

export async function recordRecentUser(db, env, account, ip, now) {
  if (!enabled(env) || !account) return
  await db.query(`INSERT INTO tech2d.agenda_recent_users(uid,email,last_seen_at,network_key)
    SELECT $1,$2,$3,$4 FROM tech2d.migration_state WHERE id=true AND production_enabled AND application_seeded
    ON CONFLICT(uid) DO UPDATE SET email=excluded.email, last_seen_at=excluded.last_seen_at, network_key=excluded.network_key
    WHERE tech2d.agenda_recent_users.last_seen_at <= excluded.last_seen_at`, [account.uid, emailValue(account.email), now.toISOString(), networkKey(env, ip)])
}

export async function pruneRecentUsers(db, env, now) {
  if (!enabled(env)) return
  await db.query("DELETE FROM tech2d.agenda_recent_users WHERE last_seen_at < $1::timestamptz - interval '90 days'", [now.toISOString()])
}

export async function handleModeration(request, env, { connect, verify, reply, readJson, secretMatches }, internal) {
  if (!enabled(env)) return internal ? new Response(null, { status: 204 }) : reply({ message: 'Controle de acesso ainda indisponível.' }, 503)
  if (internal ? request.method !== 'POST' : !['GET', 'POST'].includes(request.method)) return reply({ message: 'Método não permitido.' }, 405)
  const fail = (message, status = 400) => reply({ message }, status)
  const account = internal ? null : await verify(request, env)
  if (internal && !await secretMatches(request.headers.get('Authorization')?.replace(/^Bearer /, ''), env.WEB_DATA_KEY)) {
    return fail('Acesso restrito.', 403)
  }
  const db = await connect(env)
  try {
    if (internal) {
      const input = await readJson(request, 2048)
      const identity = typeof input?.uid === 'string' && input.uid.length <= 128 ? { uid: input.uid, email: emailValue(input.email) } : null
      await assertAgendaAllowed(db, env, { account: identity, ip: input?.ip })
      return new Response(null, { status: 204 })
    }
    if (!await isSuperadmin(db, account.uid)) return fail('Apenas superadministradores podem gerenciar acessos.', 403)
    if (request.method === 'GET') {
      const query = new URL(request.url).searchParams
      const search = (query.get('q') || '').trim().toLowerCase()
      const offset = Number(query.get('offset') || 0)
      const blockOffset = Number(query.get('blockOffset') || 0)
      const validOffset = value => Number.isInteger(value) && value >= 0 && value <= 10000
      if (search.length > 254 || !validOffset(offset) || !validOffset(blockOffset)) return fail('Confira a busca.')
      const { rows } = await db.query(`SELECT u.uid, u.email, u.last_seen_at AS "lastSeen",
        (a.data->>'role' = 'superadmin') IS TRUE AS protected,
        EXISTS(SELECT FROM tech2d.agenda_blocks b WHERE b.kind='email' AND b.target=u.email) AS "emailBlocked",
        EXISTS(SELECT FROM tech2d.agenda_blocks b WHERE b.kind='ip' AND b.target=u.network_key) AS "networkBlocked",
        u.network_key IS NOT NULL AS "hasNetwork"
        FROM tech2d.agenda_recent_users u LEFT JOIN tech2d.app_documents a ON a.path='admins/' || u.uid
        WHERE u.last_seen_at >= now() - interval '7 days'
        AND ($1='' OR strpos(coalesce(u.email,''),$1)>0 OR strpos(lower(u.uid),$1)>0)
        ORDER BY u.last_seen_at DESC,u.uid LIMIT 51 OFFSET $2`, [search, offset])
      const { rows: blocks } = await db.query(`SELECT id, kind,
        CASE WHEN kind='email' THEN target ELSE 'Rede ' || left(target,8) END AS label,
        created_at AS "createdAt" FROM tech2d.agenda_blocks ORDER BY created_at DESC,id LIMIT 51 OFFSET $1`, [blockOffset])
      return reply({ users: rows.slice(0, 50), hasMore: rows.length > 50, blocks: blocks.slice(0, 50), hasMoreBlocks: blocks.length > 50 })
    }

    if (!request.headers.get('Origin')) return fail('Origem obrigatória.', 403)
    if (env.APPLICATION_WRITES_ENABLED !== 'true') return fail('O painel está em modo somente leitura.', 503)
    const input = await readJson(request, 2048)
    if (input?.action === 'unblock' && typeof input.id === 'string' && uuid.test(input.id)) {
      await db.query('DELETE FROM tech2d.agenda_blocks WHERE id=$1', [input.id])
      return reply({ ok: true })
    }
    if (input?.action !== 'block') return fail('Operação inválida.')
    let kind = input.kind
    let target = null
    if (kind === 'email') {
      target = emailValue(input.value)
      if (!validEmail(target)) return fail('Informe um e-mail válido.')
      if (target === emailValue(account.email)) return fail('Você não pode bloquear seu próprio e-mail.')
    } else if (kind === 'ip') {
      target = networkKey(env, typeof input.value === 'string' ? input.value.trim() : null)
      if (!target) return fail('Informe um endereço IPv4 ou IPv6 exato.')
    } else if (kind === 'recent-network' && typeof input.value === 'string' && input.value.length <= 128) {
      if (input.value === account.uid) return fail('Você não pode bloquear sua própria rede.')
      const { rows } = await db.query("SELECT network_key FROM tech2d.agenda_recent_users WHERE uid=$1 AND last_seen_at>=now()-interval '7 days'", [input.value])
      target = rows[0]?.network_key
      if (!target) return fail('Nenhum IP recente disponível para esta conta.', 404)
      kind = 'ip'
    } else {
      return fail('Tipo de bloqueio inválido.')
    }
    if (kind === 'ip' && target === networkKey(env, clientIp(request))) return fail('Você não pode bloquear a rede que está usando.')
    await db.query(`INSERT INTO tech2d.agenda_blocks(id,kind,target,created_by)
      VALUES ($1,$2,$3,$4) ON CONFLICT(kind,target) DO NOTHING`, [crypto.randomUUID(), kind, target, account.uid])
    return reply({ ok: true })
  } finally {
    await db.end().catch(() => {})
  }
}
