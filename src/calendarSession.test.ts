import { describe, expect, it, vi } from 'vitest'
import { observeCalendarSession } from './calendarSession'
import { canCreateForSelectedClass } from './quickCreate'
import type { AdminProfile } from './types'

function fixture() {
  let accountChanged: (uid: string | null) => void = () => {}
  let profile: AdminProfile | null = null
  const listeners = new Map<string, { change: (profile: AdminProfile | null) => void; error: () => void; stop: ReturnType<typeof vi.fn> }>()
  const reset = vi.fn()
  const stop = observeCalendarSession({
    subscribeAccount: change => { accountChanged = change; return vi.fn() },
    subscribeProfile: (uid, change, error) => { const stop = vi.fn(); listeners.set(uid, { change, error, stop }); return stop },
    publish: value => { profile = value },
    reset,
  })
  return { account: (uid: string | null) => accountChanged(uid), listeners, reset, stop, canAdd: () => canCreateForSelectedClass(profile, '2° TECH D') }
}

describe('permissões ao trocar a conta do calendário', () => {
  it('retira o botão imediatamente ao trocar de admin para aluno e ignora respostas antigas', () => {
    const state = fixture()
    state.account('admin')
    state.listeners.get('admin')!.change({ role: 'superadmin' })
    expect(state.canAdd()).toBe(true)
    state.account('aluno')
    expect(state.canAdd()).toBe(false)
    expect(state.listeners.get('admin')!.stop).toHaveBeenCalled()
    state.listeners.get('admin')!.change({ role: 'superadmin' })
    state.listeners.get('aluno')!.change(null)
    expect(state.canAdd()).toBe(false)
    expect(state.reset).toHaveBeenCalledTimes(2)
  })
  it('só libera a nova conta depois da confirmação e respeita sua turma', () => {
    const state = fixture()
    state.account('representante')
    expect(state.canAdd()).toBe(false)
    state.listeners.get('representante')!.change({ role: 'representante', turmaId: '2° TECH E' })
    expect(state.canAdd()).toBe(false)
    state.listeners.get('representante')!.change({ role: 'representante', turmaId: '2° TECH D' })
    expect(state.canAdd()).toBe(true)
    state.listeners.get('representante')!.error()
    expect(state.canAdd()).toBe(false)
  })
  it('limpa acesso no logout e descarta callbacks após desmontar', () => {
    const state = fixture()
    state.account('admin')
    state.listeners.get('admin')!.change({ role: 'superadmin' })
    state.account(null)
    state.listeners.get('admin')!.change({ role: 'superadmin' })
    expect(state.canAdd()).toBe(false)
    state.stop()
    state.account('admin')
    state.listeners.get('admin')!.change({ role: 'superadmin' })
    expect(state.canAdd()).toBe(false)
  })
})
