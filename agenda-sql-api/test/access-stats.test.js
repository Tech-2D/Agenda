import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createHandler } from '../src/worker.js'
import { handleAccessStats, pruneAgendaAccess } from '../src/access-stats.js'

const engine = new PGlite()
for (const name of ['001_initial', '002_application', '004_agenda_access']) {
  await engine.exec(await readFile(new URL('../migrations/' + name + '.sql', import.meta.url), 'utf8'))
}
after(() => engine.close())
await engine.query('UPDATE tech2d.migration_state SET application_seeded=true, production_enabled=true WHERE id=true')
for (const [uid, role] of [['owner', 'superadmin'], ['rep', 'representante']]) {
  await engine.query("INSERT INTO tech2d.app_documents (path, collection, id, data) VALUES ($1, 'admins', $2, $3::jsonb)", ['admins/' + uid, uid, JSON.stringify({ role })])
}
const origin = 'https://tech-2d.github.io'
const env = { MIGRATION_READY: 'true', APPLICATION_DATA_ENABLED: 'true', APPLICATION_WRITES_ENABLED: 'true', AGENDA_ACCESS_HMAC_KEY: 'a'.repeat(48) }
const db = { query: (sql, params) => engine.query(sql, params), end: async () => {} }
const verify = async request => {
  const uid = request.headers.get('Authorization')?.split(' ')[1]
  if (!['owner', 'rep', 'student'].includes(uid)) throw Object.assign(Error('UNAUTHENTICATED'), { status: 401 })
  return { uid }
}
const connect = async () => db
const request = (path, init) => new Request('https://worker.example' + path, init)
const stats = '/api/admin/agenda-access'
const record = '/api/agenda-access'
const makeVisit = headers => request(record, { method: 'POST', headers: { Origin: origin, ...headers } })
const invoke = (req, route, now) => handleAccessStats(req, env, {
  connect, verify, origin: req.headers.get('Origin'), reply: (data, status = 200) => Response.json(data, { status }),
}, route, new Date(now))

test('deduplicates accesses per interval and aggregates them by Brasília date', async () => {
  const anonymous = makeVisit({ 'CF-Connecting-IP': '192.0.2.24', 'X-Forwarded-For': '198.51.100.9' })
  const student = makeVisit({ Authorization: 'Bearer student', 'CF-Connecting-IP': '192.0.2.24' })
  for (const [visit, time] of [
    [anonymous, '2026-11-10T02:43:00Z'],
    [anonymous, '2026-11-10T02:59:00Z'],
    [anonymous, '2026-11-10T03:00:00Z'],
    [student, '2026-11-10T03:01:00Z'],
    [student, '2026-11-10T03:41:00Z'],
    [makeVisit({ 'X-Forwarded-For': '192.0.2.25' }), '2026-11-10T03:42:00Z'],
  ]) assert.equal((await invoke(visit, 'record', time)).status, 204)
  const keys = (await db.query('SELECT DISTINCT kind, visitor_key FROM tech2d.agenda_access')).rows
  assert.equal(keys.filter(row => row.kind === 'anonymous').length, 2)
  assert.ok(keys.filter(row => row.kind === 'anonymous').every(row => /^[0-9a-f]{64}$/.test(row.visitor_key)))
  assert.equal(keys.find(row => row.kind === 'account').visitor_key, 'student')
  const response = await invoke(request(stats + '?days=7', { headers: { Authorization: 'Bearer owner' } }), 'stats', '2026-11-10T04:00:00Z')
  assert.deepEqual(await response.json(), {
    today: '2026-11-10',
    total: { authenticated: 2, anonymous: 2, accounts: 1 },
    daily: [
      { date: '2026-11-10', authenticated: 2, anonymous: 1, accounts: 1 },
      { date: '2026-11-09', authenticated: 0, anonymous: 1, accounts: 0 },
    ],
  })
})

test('only superadmin can read statistics and callers cannot supply arbitrary UIDs', async () => {
  const worker = createHandler({ connect, verify })
  assert.equal((await worker(request(stats), env)).status, 401)
  for (const token of ['rep', 'student']) {
    assert.equal((await worker(request(stats, { headers: { Authorization: 'Bearer ' + token } }), env)).status, 403)
  }
  const owner = await worker(request(stats, { headers: { Authorization: 'Bearer owner' } }), env)
  assert.equal(owner.status, 200)
  assert.equal(owner.headers.get('Cache-Control'), 'no-store')
  assert.equal((await worker(request(stats + '?days=90', { headers: { Authorization: 'Bearer owner' } }), env)).status, 400)
  assert.equal((await worker(makeVisit({ Authorization: 'Bearer invalid', 'CF-Connecting-IP': '192.0.2.24' }), env)).status, 401)
  assert.equal((await worker(request(record, { method: 'POST', headers: { Origin: origin }, body: '{"uid":"owner"}' }), env)).status, 400)
  const emptyStream = new ReadableStream({ start: controller => controller.close() })
  assert.equal((await worker(request(record, { method: 'POST', headers: { Origin: origin }, body: emptyStream, duplex: 'half' }), env)).status, 204)
  assert.equal((await worker(request(record, { method: 'POST' }), env)).status, 403)
})

test('retention removes expired rows and keeps the current 90 days', async () => {
  await db.query("INSERT INTO tech2d.agenda_access(day,half_hour,kind,visitor_key) VALUES ('2026-08-12',1,'account','expired'), ('2026-08-13',1,'account','retained')")
  await pruneAgendaAccess(db, new Date('2026-11-10T04:00:00Z'))
  const { rows } = await db.query("SELECT visitor_key FROM tech2d.agenda_access WHERE visitor_key IN ('expired', 'retained')")
  assert.deepEqual(rows, [{ visitor_key: 'retained' }])
})
