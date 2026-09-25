import { CLASS_NAMES } from './classNames'

const SHARED_KEY = 'tech-2d:preferredClass'
const LEGACY_AGENDA_KEY = 'agenda:turma'

const PROFESSOR_CLASS_BY_AGENDA_CLASS: Record<(typeof CLASS_NAMES)[number], string> = {
  '2° TECH D': '2º Tec D',
  '2° TECH E': '2º Tec E',
  '2° TECH F': '2º Tec F',
  '2° TECH G': '2º Tec G',
  '2° TECH H': '2º Tec H',
  '2° TECH I': '2º Tec I',
}

const AGENDA_CLASS_BY_PROFESSOR_CLASS = Object.fromEntries(
  Object.entries(PROFESSOR_CLASS_BY_AGENDA_CLASS).map(([agendaClass, professorClass]) => [professorClass, agendaClass]),
) as Record<string, string>

export function readPreferredTurma(): string | null {
  try {
    const shared = window.localStorage.getItem(SHARED_KEY)
    if (shared !== null) return AGENDA_CLASS_BY_PROFESSOR_CLASS[shared] ?? null
    const legacy = window.localStorage.getItem(LEGACY_AGENDA_KEY)
    return legacy && (CLASS_NAMES as readonly string[]).includes(legacy) ? legacy : null
  } catch {
    return null
  }
}

export function savePreferredTurma(turmaId: string): void {
  if (!(CLASS_NAMES as readonly string[]).includes(turmaId)) return
  try {
    window.localStorage.setItem(SHARED_KEY, PROFESSOR_CLASS_BY_AGENDA_CLASS[turmaId as (typeof CLASS_NAMES)[number]])
    window.localStorage.setItem(LEGACY_AGENDA_KEY, turmaId)
  } catch {
    // Sem armazenamento, a escolha ainda vale até a página ser fechada.
  }
}
