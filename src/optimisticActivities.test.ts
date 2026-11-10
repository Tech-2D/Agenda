import {afterEach,expect,it} from 'vitest'
import {mergeQueuedActivities,setActivityDrafts} from './optimisticActivities'
import type {QueueView} from './writeQueue'
const draft=(id:string,turmaId:string|null):QueueView=>({key:id,path:'activities/'+id,kind:'activity-create',value:{path:'activities/'+id,id,data:{title:'Pendente',turmaId,date:'2026-11-10',updatedAt:'2026-11-09T12:00:00Z'},version:null},confirmed:null,pending:1,failed:null,label:'Create',sending:false})
afterEach(()=>setActivityDrafts([]))
it('shows a staged activity immediately in its class without mutating the server snapshot',()=>{
  const server=[{id:'existing',title:'Existing'}] as never[]
  setActivityDrafts([draft('new','2° TECH D'),draft('other','2° TECH E'),draft('global',null)])
  const merged=mergeQueuedActivities(server,'2° TECH D',true)
  expect(merged.map(a=>a.id)).toEqual(['existing','new','global']);expect(server).toHaveLength(1)
  expect(merged[1].updatedAt?.toDate().toISOString()).toBe('2026-11-09T12:00:00.000Z')
})
it('removes a moved draft from the old class and clears drafts when account ownership resets',()=>{
  setActivityDrafts([draft('one','2° TECH E')])
  expect(mergeQueuedActivities([{id:'one',turmaId:'2° TECH D'}] as never[],'2° TECH D')).toEqual([])
  setActivityDrafts([])
  expect(mergeQueuedActivities([])).toEqual([])
})
