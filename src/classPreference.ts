import { CLASS_NAMES } from './classNames'

const SHARED_KEY = 'tech-2d:preferredClass'
const LEGACY_AGENDA_KEY = 'agenda:turma'

const PROFESSOR_CLASS_BY_AGENDA_CLASS: Record<string, string> = {
  '2° TECH D': '2º Tec D',
  '2° TECH E': '2º Tec E',
  '2° TECH F': '2º Tec F',
  '2° TECH G': '2º Tec G',
  '2° TECH H': '2º Tec H',
  '2° TECH I': '2º Tec I',
  '3° TECH AD H': '3º Tec AD H',
  '3° TECH AD I': '3º Tec AD I',
  '3° TECH DS E': '3º Tec DS E',
  '3° TECH DS F': '3º Tec DS F',
  '3° TECH DS G': '3º Tec DS G',
}

export function readPreferredClass(): string | null {
  try {
    const shared = window.localStorage.getItem(SHARED_KEY)
    if (shared !== null) return (CLASS_NAMES as readonly string[]).includes(shared) ? shared : null

    const legacy = window.localStorage.getItem(LEGACY_AGENDA_KEY)
    return legacy ? PROFESSOR_CLASS_BY_AGENDA_CLASS[legacy] ?? null : null
  } catch {
    return null
  }
}

export function savePreferredClass(className: string): void {
  if (!(CLASS_NAMES as readonly string[]).includes(className)) return
  try {
    window.localStorage.setItem(SHARED_KEY, className)
  } catch {
    // Sem armazenamento, a escolha ainda vale até a página ser fechada.
  }
}
