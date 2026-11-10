import {afterEach,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({native:vi.fn(),pending:vi.fn()}))
vi.mock('firebase/auth',()=>({signOut:mocks.native}))
vi.mock('./queuedWrites',()=>({queuedWrites:{pending:mocks.pending}}))
import {signOut} from './sessionActions'
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals()})
it('does not discard pending drafts when the user cancels account switching',async()=>{
  mocks.pending.mockReturnValue([{pending:1}]);const confirm=vi.fn(()=>false);vi.stubGlobal('window',{confirm})
  await signOut({} as never)
  expect(confirm).toHaveBeenCalled();expect(mocks.native).not.toHaveBeenCalled()
})
it('allows account switching only after explicit confirmation of pending drafts',async()=>{
  mocks.pending.mockReturnValue([{pending:1}]);vi.stubGlobal('window',{confirm:()=>true})
  await signOut({} as never);expect(mocks.native).toHaveBeenCalledTimes(1)
})
it('does not interrupt signing out when there are no pending writes',async()=>{
  mocks.pending.mockReturnValue([]);const confirm=vi.fn();vi.stubGlobal('window',{confirm})
  await signOut({} as never);expect(confirm).not.toHaveBeenCalled();expect(mocks.native).toHaveBeenCalledTimes(1)
})
