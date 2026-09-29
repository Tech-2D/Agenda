import { professorClassFor } from './classPreference'

const TEACHER_FINDER_BASE_URL = 'https://tech-2d.github.io/professores/'

// Linka direto para a grade de hoje da turma no Cadê o professor?. Turmas sem
// par conhecido lá (ex.: pedidas dinamicamente) abrem sem o filtro de turma,
// mas ainda em "Hoje" — o site lembra a última turma escolhida em qualquer um
// dos dois sites, pelo localStorage compartilhado.
export function teacherFinderTodayUrl(turmaId: string | null): string {
  const params = new URLSearchParams({ view: 'hoje' })
  const professorClass = turmaId ? professorClassFor(turmaId) : null
  if (professorClass) params.set('turma', professorClass)
  return `${TEACHER_FINDER_BASE_URL}?${params.toString()}`
}
