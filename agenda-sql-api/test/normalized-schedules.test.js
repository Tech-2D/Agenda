import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createHandler } from '../src/worker.js'

test('normalizes existing and new schedule rows while preserving the catalog API', async () => {
  const db = new PGlite()
  try {
    const migrate = async name => db.exec(await readFile(new URL('../migrations/' + name + '.sql', import.meta.url), 'utf8'))
    const write = (id, data) => db.query(`INSERT INTO tech2d.catalog_documents(collection,id,data)
      VALUES ('schedules',$1,$2) ON CONFLICT(collection,id) DO UPDATE SET data=excluded.data`, [id, JSON.stringify(data)])
    const schedule = {
      professor: 'Ágata Exemplo', subject: 'Matemática', className: 'D',
      startTime: '07:00', endTime: '07:50', dayOfWeek: 1, active: true, floor: '', roomDescription: 'Sala 12',
    }
    await migrate('001_initial')
    await write('first', schedule)
    await write('second', { ...schedule, dayOfWeek: 2 })
    await migrate('007_normalize_schedules')
    assert.deepEqual((await db.query("SELECT data FROM tech2d.catalog_documents WHERE id='first'")).rows[0].data, schedule)
    const afterCutover = () => migrate('008_compact_schedule_catalog')
    await afterCutover()
    await migrate('007_normalize_schedules')
    await afterCutover()
    assert.deepEqual((await db.query("SELECT data FROM tech2d.catalog_documents WHERE id='first'")).rows[0].data, { floor: '', roomDescription: 'Sala 12' })
    const counts = (await db.query(`SELECT count(DISTINCT teacher_id)::int AS teachers,
      count(DISTINCT subject_id)::int AS subjects, count(DISTINCT class_id)::int AS classes,
      count(DISTINCT time_slot_id)::int AS slots FROM tech2d.school_schedules`)).rows[0]
    assert.deepEqual(counts, { teachers: 1, subjects: 1, classes: 1, slots: 1 })
    const handler = createHandler({ connect: async () => ({ query: db.query.bind(db), end: async () => {} }) })
    const read = async filter => {
      const response = await handler(new Request('https://worker.example/api/catalog/schedules' + filter), { MIGRATION_READY: 'true' })
      assert.equal(response.status, 200)
      return (await response.json()).schedules
    }
    assert.deepEqual(await read('?class=D&day=1&q=agata'), [{ id: 'first', ...schedule }])
    await write('third', { ...schedule, dayOfWeek: 3 })
    await write('first', { ...schedule, active: false })
    assert.deepEqual(await read('?day=1'), [])
    assert.equal((await read('?day=3'))[0].id, 'third')
    await assert.rejects(write('third', { ...schedule, startTime: '25:00' }), /Invalid schedule projection/)
    assert.equal((await read('?day=3'))[0].startTime, '07:00')
    await db.query("DELETE FROM tech2d.catalog_documents WHERE collection='schedules' AND id='third'")
    assert.deepEqual(await read('?day=3'), [])
    assert.equal((await db.query("SELECT id FROM tech2d.school_schedules WHERE id='third'")).rows.length, 0)
  } finally {
    await db.close()
  }
})
