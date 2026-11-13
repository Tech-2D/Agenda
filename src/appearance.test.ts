import { afterEach, expect, it, vi } from 'vitest'
import { applyStoredAppearance, observeStoredAppearance } from './appearance'
afterEach(()=>vi.unstubAllGlobals())
it('applies the same theme, neon and accessibility preferences in Pegaki',()=>{
  const values=new Map([['agenda:theme','cyberpunk'],['agenda:neon','rosa'],['agenda:fontScale','grande'],['agenda:highContrast','1']])
  const dataset:Record<string,string>={}
  let listener:((event:{key:string|null})=>void)|undefined
  vi.stubGlobal('document',{documentElement:{dataset}})
  vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>values.get(k)??null},addEventListener:(_key:string,fn:typeof listener)=>{listener=fn},removeEventListener:vi.fn()})
  const stop=observeStoredAppearance()
  expect(dataset).toMatchObject({theme:'cyberpunk',neon:'rosa',contrast:'alto',fontScale:'grande'})
  values.set('agenda:theme','roxo');listener!({key:'agenda:theme'})
  expect(dataset.theme).toBe('roxo')
  values.clear();applyStoredAppearance();expect(dataset.theme).toBe('padrao');stop()
})
