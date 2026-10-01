const KEY = 'tech-2d:compareTurmas'

// Lembra a última combinação de turmas marcada no modo "Comparar turmas",
// filtrando por turmas que ainda existem — evita guardar lixo de turmas
// removidas ou digitadas errado em algum momento.
export function readCompareTurmas(knownClassNames: readonly string[]): string[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const known = new Set(knownClassNames)
    return parsed.filter((item): item is string => typeof item === 'string' && known.has(item))
  } catch {
    return []
  }
}

export function saveCompareTurmas(turmas: string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(turmas))
  } catch {
    // Sem armazenamento, a seleção só vale até a aba fechar.
  }
}

export function toggleTurma(turmas: string[], turmaId: string): string[] {
  return turmas.includes(turmaId) ? turmas.filter((item) => item !== turmaId) : [...turmas, turmaId]
}

// Rótulo curto só para caber no chip do calendário mensal (ex.: "2° TECH D" -> "D").
// Nomes fora desse padrão (turmas pedidas dinamicamente, sem espaço) aparecem
// inteiros — não tentamos adivinhar curso/série, só encurtar quando dá.
export function shortTurmaLabel(turmaId: string): string {
  const parts = turmaId.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : turmaId
}
