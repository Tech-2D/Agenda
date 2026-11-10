import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createHandler } from '../src/worker.js'

const engine = new PGlite()
after(() => engine.close())
for (const migration of ['001_initial', '002_application', '004_agenda_access', '005_agenda_moderation']) {
  await engine.exec(await readFile(new URL('../migrations/' + migration + '.sql', import.meta.url), 'utf8'))
}
await engine.exec(`UPDATE tech2d.migration_state SET application_seeded=true, production_enabled=true WHERE id=true;
  INSERT INTO tech2d.app_documents(path,collection,id,data) VALUES ('admins/owner','admins','owner','{"role":"superadmin"}');`)

const usersPath = '/api/admin/agenda-users'
const internalPath = '/api/internal/agenda-access-check'
const visitPath = '/api/agenda-access'
const ip = '192.0.2.42'
const serviceKey = 's'.repeat(48)
const env = {
  AGENDA_MODERATION_ENABLED: 'true', AGENDA_ACCESS_HMAC_KEY: 'h'.repeat(48),
  APPLICATION_DATA_ENABLED: 'true', APPLICATION_WRITES_ENABLED: 'true', MIGRATION_READY: 'true',
  WEB_DATA_KEY: serviceKey,
}
const identities = new Map([['owner', 'owner@example.test'], ['student', 'Student@example.test']])
const worker = createHandler({
  connect: async () => ({ query: engine.query.bind(engine), end: async () => {} }),
  verify: async request => {
    const uid = request.headers.get('Authorization')?.replace(/^Bearer /, '')
    if (!identities.has(uid)) throw Object.assign(new Error('Acesso restrito.'), { status: 401 })
    return { uid, email: identities.get(uid) }
  },
})

function call(path, { method = 'GET', token, body, headers } = {}) {
  return worker(new Request('https://worker.example' + path, {
    method,
    headers: {
      Origin: 'https://tech-2d.github.io',
      ...(token && { Authorization: 'Bearer ' + token }),
      ...(body && { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body && JSON.stringify(body),
  }), env)
}
const updateBlock = (body, headers) => call(usersPath, { method: 'POST', token: 'owner', body, headers })

test('only superadmins see recent identities, and an exact network block is reversible', async () => {
  assert.equal((await call(usersPath)).status, 401)
  assert.equal((await call(usersPath, { token: 'student' })).status, 403)
  assert.equal((await call(visitPath, { method: 'POST', token: 'student', headers: { 'CF-Connecting-IP': ip } })).status, 204)
  const recent = await (await call(usersPath + '?q=STUDENT', { token: 'owner' })).json()
  assert.equal(recent.users.length, 1)
  assert.equal(recent.users[0].email, 'student@example.test')
  assert.equal(recent.users[0].hasNetwork, true)
  assert.ok(!JSON.stringify(recent).includes(ip))

  const block = { action: 'block', kind: 'recent-network', value: 'student' }
  assert.equal((await updateBlock(block, { 'CF-Connecting-IP': ip })).status, 400)
  assert.equal((await updateBlock(block)).status, 200)
  const blocked = await call(visitPath, { method: 'POST', headers: { 'CF-Connecting-IP': '::ffff:' + ip } })
  assert.equal(blocked.status, 403)
  assert.equal((await blocked.json()).code, 'agenda-access-blocked')
  assert.equal((await call(visitPath, { method: 'POST', headers: { 'X-Forwarded-For': ip } })).status, 204)
  const panel = await (await call(usersPath, { token: 'owner' })).json()
  assert.equal(panel.users[0].networkBlocked, true)
  assert.match(panel.blocks[0].label, /^Rede [a-f0-9]{8}$/)
  assert.equal((await updateBlock({ action: 'unblock', id: panel.blocks[0].id })).status, 200)
  assert.equal((await call(visitPath, { method: 'POST', headers: { 'CF-Connecting-IP': ip } })).status, 204)
})

test('email blocks follow verified identities and stay scoped to Agenda data', async () => {
  assert.equal((await updateBlock({ action: 'block', kind: 'email', value: 'OWNER@example.test' })).status, 400)
  assert.equal((await updateBlock({ action: 'block', kind: 'ip', value: 'fe80::1%eth0' })).status, 400)
  assert.equal((await updateBlock({ action: 'block', kind: 'email', value: ' Student@example.test ' })).status, 200)
  const document = path => call('/api/data', { method: 'POST', token: 'student', body: { action: 'get', path } })
  assert.equal((await document('activities/example')).status, 403)
  assert.equal((await document('schedules/example')).status, 200)
  const identity = { uid: 'student', email: 'student@example.test' }
  const serviceCheck = token => call(internalPath, { method: 'POST', token, body: identity })
  assert.equal((await serviceCheck('student')).status, 403)
  const blocked = await serviceCheck(serviceKey)
  assert.equal(blocked.status, 403)
  assert.equal((await blocked.json()).code, 'agenda-access-blocked')
  assert.equal((await call(visitPath, { method: 'POST' })).status, 204)
})
