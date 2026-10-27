export type Situation = "aprovado" | "aprovado-rec" | "recuperacao" | "reprovado" | "andamento" | "sem-notas";

export interface Result {
  recovered: number | null;   // média recuperada (só quando 2º sem > 1º)
  annual: number | null;
  needed: number | null;      // nota necessária na recuperação final
  final: number | null;
  situation: Situation;
}

export const ANNUAL_PASS = 7;
export const FINAL_PASS = 6;
export const RECOVERED_CAP = 7;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Média anual = (M1 + M2 × 2) / 3. Com só o 1º semestre, a anual é a própria M1. */
export function calculate(m1: number | null, m2: number | null, rec: number | null): Result {
  if (m1 === null && m2 === null) {
    return { recovered: null, annual: null, needed: null, final: null, situation: "sem-notas" };
  }
  if (m2 === null) {
    const annual = m1!;
    return { recovered: null, annual, needed: null, final: null, situation: "andamento" };
  }
  const first = m1 ?? 0;
  // Se o 2º semestre supera o 1º, a média recuperada passa a compor a anual (teto 7,00).
  // Ela só substitui o 1º semestre quando aumenta a nota: com M1 ≥ 7 o teto nunca pode rebaixá-la.
  const candidate = round2(Math.min((first + m2) / 2, RECOVERED_CAP));
  const recovered = m2 > first && candidate > first ? candidate : null;
  const annual = round2(((recovered ?? first) + m2 * 2) / 3);

  if (annual >= ANNUAL_PASS) {
    return { recovered, annual, needed: null, final: null, situation: "aprovado" };
  }
  const needed = Math.max(0, round2(FINAL_PASS * 2 - annual));
  if (rec === null) {
    return { recovered, annual, needed, final: null, situation: "recuperacao" };
  }
  const final = round2((rec + annual) / 2);
  return { recovered, annual, needed, final, situation: final >= FINAL_PASS ? "aprovado-rec" : "reprovado" };
}

export const DEFAULT_N1_WEIGHT = 50;

/**
 * Média do semestre = N1 × peso + N2 × (100 − peso), com o peso da N1 em %.
 * No padrão (50%) é a média simples. Só existe quando as duas notas foram lançadas.
 */
export function semesterAverage(n1: number | null, n2: number | null, n1Weight = DEFAULT_N1_WEIGHT): number | null {
  return n1 === null || n2 === null ? null : round2((n1 * n1Weight + n2 * (100 - n1Weight)) / 100);
}

/** Como as notas são lançadas: N1 e N2 de cada semestre, ou a média do semestre já pronta. */
export type InputMode = "notas" | "media";

export interface Notes {
  s1n1: number | null;
  s1n2: number | null;
  s2n1: number | null;
  s2n2: number | null;
  rec: number | null;
  /** Peso da N1 em % em cada semestre (a N2 fica com o resto). */
  s1Weight?: number;
  s2Weight?: number;
}

export interface NotesResult extends Result {
  m1: number | null;
  m2: number | null;
}

/** Calcula tudo a partir das notas N1/N2 de cada semestre. */
export function calculateFromNotes(n: Notes): NotesResult {
  const m1 = semesterAverage(n.s1n1, n.s1n2, n.s1Weight);
  const m2 = semesterAverage(n.s2n1, n.s2n2, n.s2Weight);
  const result = calculate(m1, m2, n.rec);
  // Com alguma nota lançada mas nenhum semestre completo, o ano está em andamento.
  const anyNote = [n.s1n1, n.s1n2, n.s2n1, n.s2n2].some((v) => v !== null);
  if (result.situation === "sem-notas" && anyNote) result.situation = "andamento";
  return { ...result, m1, m2 };
}

/** Calcula a partir das médias semestrais digitadas direto, sem N1/N2. */
export function calculateFromAverages(m1: number | null, m2: number | null, rec: number | null): NotesResult {
  return { ...calculate(m1, m2, rec), m1, m2 };
}

export const fmt =(n: number | null) => (n === null ? "-" : n.toFixed(2).replace(".", ","));

export function parseGrade(raw: string): number | null {
  const n = parseFloat(raw.replace(",", "."));
  if (Number.isNaN(n)) return null;
  return Math.min(10, Math.max(0, n));
}
