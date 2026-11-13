import { test } from "vitest";
import assert from "node:assert/strict";
import { BoletimError, matchSubjects, parseBoletim, type TextItem } from "./boletim";

// Posições (x, largura) iguais às do PDF do boletim da escola.
const HEAD: [string, number, number][] = [
  ["Disciplinas", 19.5, 39.6],
  ["1ºSem", 267.8, 22.8],
  ["Faltas", 306.5, 21.7],
  ["2ºSem", 344.2, 22.8],
  ["Faltas", 382.9, 21.7],
  ["MA", 418.8, 11.7],
  ["RF", 442.8, 10],
  ["MF", 465, 10.8],
  ["% Freq", 493.5, 25],
  ["Situação", 539.4, 31.3],
];
// Onde cada valor fica, centralizado na coluna.
const CELL_X = [271.9, 315.3, 354.3, 392.5, 423.4, 446.5, 469.2, 491.2, 553.8];

const at = (str: string, x: number, y: number, w = 10): TextItem => ({ str, x, y, w, page: 1 });

function row(y: number, name: string, values: string[]): TextItem[] {
  return [at(name, 19.5, y, name.length * 3.5), ...values.map((v, i) => at(v, CELL_X[i], y, v.length * 3.6))];
}

function boletim(...rows: TextItem[][]): TextItem[] {
  return [
    at("ALUNO(A): Fulano de Tal", 19.5, 734.7, 143),
    at("TURMA: 2ª Tec D - Nº 3", 291.9, 718.9, 80),
    ...HEAD.map(([s, x, w]) => at(s, x, 681.4, w)),
    ...rows.flat(),
    at("MA - Média Anual", 25, 400, 60),
    at("RF - Recuperação Final", 25, 385, 80),
  ];
}

const dash = (n: number) => Array<string>(n).fill("-");

test("lê o 1º semestre e deixa o resto vazio", () => {
  const b = boletim(
    row(666.4, "Biologia 2-ESG-Environment, Social and Governance", ["6.45", "0", ...dash(5), "100.00%", "-"]),
    row(651.4, "Desenvolvimento", ["9.50", "2", ...dash(5), "94.87%", "-"]),
  );
  assert.deepEqual(parseBoletim(b), {
    year: 2,
    rows: [
      { name: "Biologia 2-ESG-Environment, Social and Governance", s1: 6.45, s2: null, rf: null },
      { name: "Desenvolvimento", s1: 9.5, s2: null, rf: null },
    ],
  });
});

test("lê 2º semestre e recuperação final, sem confundir com as faltas", () => {
  const b = boletim(row(666.4, "Sociologia", ["5.00", "1", "6.00", "4", "5.67", "7.50", "6.58", "94.44%", "Aprovado"]));
  assert.deepEqual(parseBoletim(b).rows, [{ name: "Sociologia", s1: 5, s2: 6, rf: 7.5 }]);
});

test("ordem dos pedaços no PDF não importa", () => {
  const b = boletim(row(666.4, "UX", ["7.85", "0", ...dash(5), "100.00%", "-"])).reverse();
  assert.deepEqual(parseBoletim(b).rows, [{ name: "UX", s1: 7.85, s2: null, rf: null }]);
});

test("PDF que não é o boletim dá erro", () => {
  assert.throws(() => parseBoletim([at("Uma nota fiscal qualquer", 10, 700)]), BoletimError);
});

test("liga os nomes às disciplinas do app, ignorando acento e espaço em volta do hífen", () => {
  const rows = [
    { name: "Matemática 14-Inteligência Artificial", s1: 8.45, s2: null, rf: null },
    { name: "LINGUA INGLESA", s1: 8.55, s2: null, rf: null },
    { name: "Filosofia", s1: 7, s2: null, rf: null },
  ];
  const m = matchSubjects(rows, ["Língua Inglesa", "Matemática 14 - Inteligência Artificial"]);
  assert.deepEqual(
    m.matched.map((x) => x.subject),
    ["Matemática 14 - Inteligência Artificial", "Língua Inglesa"],
  );
  assert.deepEqual(m.unknown, ["Filosofia"]);
});
