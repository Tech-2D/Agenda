import type {Activity} from './types'
import type {QueueView} from './writeQueue'
export const QUEUED_CHANGED='tech2d-queued-writes-changed'
let drafts:QueueView[]=[]
export function setActivityDrafts(states:QueueView[]){drafts=states.filter(s=>s.kind.startsWith('activity'))}
export function pendingActivityStates(){return drafts}
export function mergeQueuedActivities(activities:Activity[],turmaId?:string | null,includeGlobal=false):Activity[] {
  const items=new Map(activities.map(a=>[a.id,a]))
  for(const state of drafts) {
    const value={...state.value.data,id:state.value.id} as unknown as Activity
    for(const field of ['createdAt','updatedAt'] as const) {
      const raw=state.value.data[field]
      if(typeof raw==='string' && Number.isFinite(Date.parse(raw)))value[field]={toDate:()=>new Date(raw)}
    }
    if(turmaId!==undefined && value.turmaId!==turmaId && !(includeGlobal && value.turmaId===null)){items.delete(value.id);continue}
    items.set(value.id,value)
  }
  return [...items.values()]
}
