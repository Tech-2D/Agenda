/*
 * Leitura do boletim da escola (o PDF "Boletim Escolar" do Instituto J&F / Germinare).
 * Esta parte não depende do PDF.js: recebe os pedaços de texto com a posição de cada um
 * e monta as linhas da tabela pelas colunas do cabeçalho.
 */

/** Um pedaço de texto da página, com a posição (x, y do canto inferior esquerdo) e a largura. */
export interface TextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  page: number;
}

export interface BoletimRow {
  /** Nome da disciplina como está no boletim. */
  name: string;
  s1: number | null;
  s2: number | null;
  /** Recuperação final. */
  rf: number | null;
}

export interface Boletim {
  /** Ano da turma ("TURMA: 2ª Tec D" → 2); null se não deu para ler. */
  year: number | null;
  rows: BoletimRow[];
}

export class BoletimError extends Error {}

// Colunas da tabela, na ordem do boletim. As duas "Faltas" ficam separadas pela posição.
const COLUMNS = ["s1", "f1", "s2", "f2", "ma", "rf", "mf", "freq", "sit"] as const;
type Column = (typeof COLUMNS)[number];

const key = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[º°ª]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();

const center = (it: TextItem) => it.x + it.w / 2;

/** Agrupa os pedaços em linhas (mesma página e mesma altura), de cima para baixo e da esquerda para a direita. */
function toLines(items: TextItem[]): TextItem[][] {
  const sorted = items.filter((it) => it.str.trim()).sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  for (const it of sorted) {
    const last = lines.at(-1);
    if (last && last[0].page === it.page && Math.abs(last[0].y - it.y) < 2) last.push(it);
    else lines.push([it]);
  }
  return lines.map((l) => l.sort((a, b) => a.x - b.x));
}

/** Centro de cada coluna, tirado da linha de cabeçalho ("Disciplinas  1ºSem  Faltas  2ºSem ..."). */
function headerColumns(line: TextItem[]): Record<Column, number> | null {
  const keys = line.map((it) => key(it.str));
  if (keys[0] !== "disciplinas") return null;
  const expected = ["1sem", "faltas", "2sem", "faltas", "ma", "rf", "mf", "%freq", "situacao"];
  const rest = line.slice(1);
  if (rest.length !== expected.length || rest.some((it, i) => key(it.str) !== expected[i])) return null;
  return Object.fromEntries(COLUMNS.map((c, i) => [c, center(rest[i])])) as Record<Column, number>;
}

/** "6.45" ou "6,45" vira número; "-" (sem nota) vira null. */
function grade(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const s = raw.trim();
  if (!/^\d{1,2}([.,]\d+)?$/.test(s)) return null;
  const n = Number(s.replace(",", "."));
  return n >= 0 && n <= 10 ? n : null;
}

export function parseBoletim(items: TextItem[]): Boletim {
  const lines = toLines(items);
  const all = lines.map((l) => l.map((it) => it.str).join(" ")).join("\n");
  const year = /TURMA:\s*(\d)\s*[ªº°]/i.exec(all);

  const rows: BoletimRow[] = [];
  let cols: Record<Column, number> | null = null;
  let sawHeader = false;

  for (const line of lines) {
    const header = headerColumns(line);
    if (header) {
      cols = header;
      sawHeader = true;
      continue;
    }
    if (!cols) continue;

    // Tudo à esquerda da coluna do 1º semestre é o nome da disciplina.
    const nameEnd = cols.s1 - (cols.f1 - cols.s1) * 0.6;
    const name = line
      .filter((it) => center(it) < nameEnd)
      .map((it) => it.str.trim())
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const cells: Partial<Record<Column, string>> = {};
    for (const it of line) {
      if (center(it) < nameEnd) continue;
      const c = COLUMNS.reduce((best, col) => (Math.abs(cols![col] - center(it)) < Math.abs(cols![best] - center(it)) ? col : best));
      cells[c] = (cells[c] ? `${cells[c]} ` : "") + it.str.trim();
    }
    // Linha da tabela: tem nome e a coluna do 1º semestre preenchida (nota ou "-").
    // As legendas embaixo ("MA - Média Anual") não têm nada nas colunas e ficam de fora.
    if (!name || cells.s1 === undefined) continue;
    rows.push({ name, s1: grade(cells.s1), s2: grade(cells.s2), rf: grade(cells.rf) });
  }

  if (!sawHeader || rows.length === 0) {
    throw new BoletimError("Não encontramos a tabela de notas. Use o PDF do boletim escolar, sem editar.");
  }
  return { year: year ? Number(year[1]) : null, rows };
}

/** Nome comparável: sem acento, sem diferença de maiúscula e com os hífens sem espaço em volta. */
export const subjectKey = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();

export interface BoletimMatch {
  /** Linhas do boletim ligadas a uma disciplina da lista do app. */
  matched: { subject: string; row: BoletimRow }[];
  /** Disciplinas do boletim que não estão na lista do ano. */
  unknown: string[];
}

export function matchSubjects(rows: BoletimRow[], subjects: string[]): BoletimMatch {
  const byKey = new Map(subjects.map((s) => [subjectKey(s), s]));
  const matched: BoletimMatch["matched"] = [];
  const unknown: string[] = [];
  for (const row of rows) {
    const subject = byKey.get(subjectKey(row.name));
    if (subject) matched.push({ subject, row });
    else unknown.push(row.name);
  }
  return { matched, unknown };
}
