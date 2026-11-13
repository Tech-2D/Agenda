import { afterEach, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'
import { notebookRequest, NotebookError } from './notebook'
afterEach(()=>vi.unstubAllGlobals())
const user={getIdToken:async()=> 'test-token'} as User
it('uses the signed-in token and never sends a client-selected owner',async()=>{
  const fetch=vi.fn().mockResolvedValue(Response.json({notebook:{version:1}}));vi.stubGlobal('fetch',fetch)
  await notebookRequest(user,2026,2,{version:0,grades:{},modes:{s1:'notas',s2:'media'}})
  const [,options]=fetch.mock.calls[0]
  expect(options.headers.Authorization).toBe('Bearer test-token')
  expect(JSON.parse(options.body)).toEqual({academicYear:2026,gradeYear:2,expectedVersion:0,grades:{},modes:{s1:'notas',s2:'media'}})
  expect(options.cache).toBe('no-store')
})
it('reports concurrent changes instead of overwriting the other device',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({message:'Mudou em outro dispositivo'},{status:409})))
  await expect(notebookRequest(user,2026,2)).rejects.toBeInstanceOf(NotebookError)
})
