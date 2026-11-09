// Personal workspaces are never public, even to representatives or superadmins.
const keys = (v, names) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v,k))
const text = (v,max,min=0) => typeof v === 'string' && v.length >= min && v.length <= max
const id = v => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(v)
const unique = list => list.every(v=>v && typeof v === 'object' && id(v.id)) && new Set(list.map(v=>v.id)).size === list.length
const colors = new Set(['blue','purple','pink','green','orange','slate'])
const date = v => v === null || typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v

export function validKanban(d) {
  if (!keys(d,['ownerId','schemaVersion','boards','createdAt','updatedAt']) || !text(d.ownerId,128,1) || d.schemaVersion !== 1 || !Array.isArray(d.boards) || d.boards.length > 12 || !unique(d.boards)) return false
  let total = 0
  for (const b of d.boards) {
    if (!keys(b,['id','name','color','compact','columns','tasks']) || !id(b.id) || !text(b.name,80,1) || !b.name.trim() || !colors.has(b.color) || typeof b.compact !== 'boolean'
      || !Array.isArray(b.columns) || b.columns.length < 1 || b.columns.length > 12 || !unique(b.columns) || !Array.isArray(b.tasks) || !unique(b.tasks)) return false
    if (!b.columns.every(c=>keys(c,['id','name','color','done']) && id(c.id) && text(c.name,60,1) && c.name.trim() && colors.has(c.color) && typeof c.done === 'boolean')) return false
    const columns = new Set(b.columns.map(c=>c.id))
    for (const t of b.tasks) {
      if (!keys(t,['id','columnId','title','description','priority','dueDate','labels','checklist']) || !id(t.id) || !columns.has(t.columnId) || !text(t.title,160,1) || !t.title.trim() || !text(t.description,3000)
        || !['none','low','medium','high'].includes(t.priority) || !date(t.dueDate) || !Array.isArray(t.labels) || t.labels.length > 6 || !t.labels.every(l=>text(l,30,1))
        || !Array.isArray(t.checklist) || t.checklist.length > 20 || !unique(t.checklist) || !t.checklist.every(i=>keys(i,['id','text','done']) && id(i.id) && text(i.text,200,1) && typeof i.done === 'boolean')) return false
    }
    total += b.tasks.length
  }
  return total <= 200 && new TextEncoder().encode(JSON.stringify(d)).length <= 750000
}

export function canWriteKanban(c,id,before,after) {
  if (!c.user || id !== c.user.uid || before && before.ownerId !== c.user.uid) return false
  if (!after) return false // Delete individual boards explicitly; no account-wide wipe endpoint.
  return validKanban(after) && after.ownerId === c.user.uid && after.updatedAt === c.now
    && (before ? after.createdAt === before.createdAt : after.createdAt === c.now)
}
