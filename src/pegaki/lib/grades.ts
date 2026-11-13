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

/** Como as notas de um semestre são lançadas: N1 e N2, ou a média do semestre já pronta. */
export type InputMode = "notas" | "media";

/** Modo de cada semestre: dá para lançar a média do 1º e a N1/N2 do 2º, por exemplo. */
export interface Modes {
  s1: InputMode;
  s2: InputMode;
}

export interface SemesterInput {
  mode: InputMode;
  n1: number | null;
  n2: number | null;
  avg: number | null;
  /** Peso da N1 em % (só no modo "notas"). */
  weight?: number;
}

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

/** Nota mínima para fechar a média anual com 7 sem ir para a recuperação. */
export interface PassTarget {
  /** Nota que cada nota que falta precisa ter; null quando nem com 10 dá. */
  min: number | null;
  /** O que falta lançar, já agrupado (as duas notas de um semestre viram "média do Xº sem."). */
  missing: string[];
}

export interface NotesResult extends Result {
  m1: number | null;
  m2: number | null;
  /** Só existe com alguma nota lançada e alguma faltando. */
  target: PassTarget | null;
}

const semesterValue = (s: SemesterInput) => (s.mode === "media" ? s.avg : semesterAverage(s.n1, s.n2, s.weight));

/** As notas ainda vazias do semestre; "fill" preenche cada uma delas com o mesmo valor. */
function blanks(s: SemesterInput) {
  return s.mode === "media" ? [s.avg] : [s.n1, s.n2];
}
function fill(s: SemesterInput, x: number): SemesterInput {
  return { ...s, n1: s.n1 ?? x, n2: s.n2 ?? x, avg: s.avg ?? x };
}

function missingLabels(s: SemesterInput, ord: string): string[] {
  if (s.mode === "media") return s.avg === null ? [`média do ${ord} sem.`] : [];
  // Sem nenhuma das duas, tirar x nas duas é o mesmo que ter média x, qualquer que seja o peso.
  if (s.n1 === null && s.n2 === null) return [`média do ${ord} sem.`];
  return [s.n1 === null ? `N1 do ${ord} sem.` : null, s.n2 === null ? `N2 do ${ord} sem.` : null].filter((v): v is string => v !== null);
}

/**
 * Menor nota (de 0,01 em 0,01) que, tirada em todas as notas que faltam, fecha a anual com 7.
 * A anual só cresce com cada nota, então dá para achar por busca binária.
 */
function passTarget(s1: SemesterInput, s2: SemesterInput): PassTarget | null {
  const all = [...blanks(s1), ...blanks(s2)];
  if (all.every((v) => v === null) || all.every((v) => v !== null)) return null;
  const annualWith = (x: number) => calculate(semesterValue(fill(s1, x)), semesterValue(fill(s2, x)), null).annual!;
  const missing = [...missingLabels(s1, "1º"), ...missingLabels(s2, "2º")];
  if (annualWith(10) < ANNUAL_PASS) return { min: null, missing };
  let lo = 0;
  let hi = 1000;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (annualWith(mid / 100) >= ANNUAL_PASS) hi = mid;
    else lo = mid + 1;
  }
  return { min: lo / 100, missing };
}

/** Calcula tudo, com cada semestre no seu modo (N1/N2 ou média). */
export function calculateSemesters(s1: SemesterInput, s2: SemesterInput, rec: number | null): NotesResult {
  const m1 = semesterValue(s1);
  const m2 = semesterValue(s2);
  const target = passTarget(s1, s2);
  const anyNote = [...blanks(s1), ...blanks(s2)].some((v) => v !== null);
  // Sem o 1º semestre ainda não dá para fechar o ano: não conta ele como zero.
  if (m1 === null && m2 !== null) {
    return { recovered: null, annual: null, needed: null, final: null, situation: "andamento", m1, m2, target };
  }
  const result = calculate(m1, m2, rec);
  // Com alguma nota lançada mas nenhum semestre completo, o ano está em andamento.
  if (result.situation === "sem-notas" && anyNote) result.situation = "andamento";
  return { ...result, m1, m2, target };
}

/** Calcula tudo a partir das notas N1/N2 de cada semestre. */
export function calculateFromNotes(n: Notes): NotesResult {
  return calculateSemesters(
    { mode: "notas", n1: n.s1n1, n2: n.s1n2, avg: null, weight: n.s1Weight },
    { mode: "notas", n1: n.s2n1, n2: n.s2n2, avg: null, weight: n.s2Weight },
    n.rec,
  );
}

/** Calcula a partir das médias semestrais digitadas direto, sem N1/N2. */
export function calculateFromAverages(m1: number | null, m2: number | null, rec: number | null): NotesResult {
  return calculateSemesters({ mode: "media", n1: null, n2: null, avg: m1 }, { mode: "media", n1: null, n2: null, avg: m2 }, rec);
}

/** Frase da nota mínima para passar direto, para mostrar na tela. */
export function describeTarget(t: PassTarget, short = false): string {
  if (t.min === null) return short ? "Nem com 10 fecha com 7" : "Nem com 10 fecha com 7: vai para a recuperação";
  if (t.min === 0) return short ? "Já garantiu o 7" : "Já garantiu o 7, mesmo tirando 0 no que falta";
  const end = short ? "" : " para passar";
  if (t.missing.length === 1) return `Precisa de ${fmt(t.min)} na ${t.missing[0]}${end}`;
  return `Precisa de ${fmt(t.min)} em cada nota que falta${end}`;
}

export const fmt = (n: number | null) => (n === null ? "-" : n.toFixed(2).replace(".", ","));

/**
 * Número inteiro acima de 10 digitado sem vírgula (ex.: 87) vira decimal com a vírgula depois
 * do primeiro dígito (8,7), já que nenhuma nota passa de 10. O resto fica como veio.
 */
export function autoComma(raw: string): string {
  return /^\d{2,}$/.test(raw) && Number(raw) > 10 ? `${raw[0]},${raw.slice(1)}` : raw;
}

export function parseGrade(raw: string): number | null {
  const n = parseFloat(raw.replace(",", "."));
  if (Number.isNaN(n)) return null;
  return Math.min(10, Math.max(0, n));
}
