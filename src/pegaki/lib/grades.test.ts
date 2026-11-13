import { test } from "vitest";
import assert from "node:assert/strict";
import { autoComma, calculate, calculateFromAverages, calculateFromNotes, calculateSemesters, describeTarget, semesterAverage } from "./grades";

const notes = (s1n1: number | null, s1n2: number | null, s2n1: number | null, s2n2: number | null, rec: number | null = null) =>
  calculateFromNotes({ s1n1, s1n2, s2n1, s2n2, rec });

test("média do semestre = (N1 + N2)/2", () => {
  assert.equal(semesterAverage(10, 9), 9.5);
  assert.equal(semesterAverage(10, null), null);
});
test("média do semestre com peso: N1 30% e N2 70%", () => {
  assert.equal(semesterAverage(6, 9, 30), 8.1);
  assert.equal(semesterAverage(6, 9, 50), 7.5);
});
test("cada semestre tem o seu peso", () => {
  const r = calculateFromNotes({ s1n1: 6, s1n2: 9, s2n1: 6, s2n2: 9, rec: null, s1Weight: 30, s2Weight: 50 });
  assert.equal(r.m1, 8.1);
  assert.equal(r.m2, 7.5);
  assert.equal(r.annual, 7.7); // (8,1 + 15)/3
});
test("notas → médias semestrais → anual", () => {
  const r = notes(10, 9, 7, 8); // 9,5 e 7,5 → (9,5 + 15)/3
  assert.equal(r.m1, 9.5);
  assert.equal(r.m2, 7.5);
  assert.equal(r.annual, 8.17);
  assert.equal(r.situation, "aprovado");
});
test("só o 1º semestre completo: anual = média do 1º", () => {
  const r = notes(10, 9, 6, null);
  assert.equal(r.annual, 9.5);
  assert.equal(r.situation, "andamento");
});
test("semestre incompleto ainda conta como em andamento", () => {
  assert.equal(notes(8, null, null, null).situation, "andamento");
  assert.equal(notes(null, null, null, null).situation, "sem-notas");
});
test("de notas até a recuperação final", () => {
  const r = notes(4, 6, 5, 7, 7); // 5 e 6 → rec. 5,5 → (5,5 + 12)/3 = 5,83 → final (7 + 5,83)/2
  assert.equal(r.annual, 5.83);
  assert.equal(r.final, 6.42);
  assert.equal(r.situation, "aprovado-rec");
});
test("médias digitadas direto seguem o mesmo cálculo", () => {
  const r = calculateFromAverages(9.5, 7.5, null);
  assert.equal(r.m1, 9.5);
  assert.equal(r.m2, 7.5);
  assert.equal(r.annual, 8.17);
  assert.equal(r.situation, "aprovado");
  assert.equal(calculateFromAverages(5, 6, 7).final, calculate(5, 6, 7).final);
  assert.equal(calculateFromAverages(null, null, null).situation, "sem-notas");
});

test("só 1º semestre: em andamento", () => {
  assert.equal(calculate(7.12, null, null).annual, 7.12);
  assert.equal(calculate(7.12, null, null).situation, "andamento");
});
test("anual = (M1 + 2·M2)/3", () => {
  assert.equal(calculate(8, 7, null).annual, 7.33);
});
test("média recuperada compõe a anual quando M2 > M1 (teto 7)", () => {
  const r = calculate(5, 9, null); // rec = min(7,7)=7 → (7+18)/3
  assert.equal(r.recovered, 7);
  assert.equal(r.annual, 8.33);
  assert.equal(r.situation, "aprovado");
});
test("média recuperada sem teto atingido", () => {
  const r = calculate(4, 6, null); // rec = 5 → (5 + 12)/3
  assert.equal(r.recovered, 5);
  assert.equal(r.annual, 5.67);
});
test("média recuperada nunca rebaixa um 1º semestre ≥ 7", () => {
  const r = calculate(8, 9, null); // sem rec: (8 + 18)/3
  assert.equal(r.recovered, null);
  assert.equal(r.annual, 8.67);
});
test("2º semestre menor não gera média recuperada", () => {
  const r = calculate(9, 6, null); // (9 + 12)/3
  assert.equal(r.recovered, null);
  assert.equal(r.annual, 7);
  assert.equal(r.situation, "aprovado");
});
test("recuperação final", () => {
  const r = calculate(4, 4, null);
  assert.equal(r.annual, 4);
  assert.equal(r.needed, 8);
  assert.equal(calculate(4, 4, 8).situation, "aprovado-rec");
  assert.equal(calculate(4, 4, 7).situation, "reprovado");
});

const media = (avg: number | null) => ({ mode: "media" as const, n1: null, n2: null, avg });
const nn = (n1: number | null, n2: number | null, weight?: number) => ({ mode: "notas" as const, n1, n2, avg: null, weight });

test("média no 1º semestre e N1/N2 no 2º", () => {
  const r = calculateSemesters(media(9.5), nn(7, 8), null);
  assert.equal(r.m1, 9.5);
  assert.equal(r.m2, 7.5);
  assert.equal(r.annual, 8.17);
  assert.equal(r.situation, "aprovado");
  assert.equal(r.target, null);
});
test("sem o 1º semestre o ano fica em andamento, sem contar ele como zero", () => {
  const r = calculateSemesters(media(null), nn(8, 8), null);
  assert.equal(r.situation, "andamento");
  assert.equal(r.annual, null);
  assert.deepEqual(r.target?.missing, ["média do 1º sem."]);
});
test("nota mínima na única nota que falta", () => {
  // M1 = 8: precisa de M2 = 6,5 → (6 + N2)/2 = 6,5 → N2 = 7 (6,99 já dá 6,495, que arredonda para 6,50)
  const r = calculateSemesters(media(8), nn(6, null), null);
  assert.equal(r.situation, "andamento");
  assert.deepEqual(r.target, { min: 6.99, missing: ["N2 do 2º sem."] });
  assert.equal(describeTarget(r.target!), "Precisa de 6,99 na N2 do 2º sem. para passar");
});
test("nota mínima é a menor que fecha com 7, contando a média recuperada", () => {
  const r = calculateSemesters(media(5), nn(null, null), null);
  const min = r.target!.min!;
  assert.deepEqual(r.target!.missing, ["média do 2º sem."]);
  assert.ok(calculate(5, min, null).annual! >= 7);
  assert.ok(calculate(5, Math.round((min - 0.01) * 100) / 100, null).annual! < 7);
});
test("nota mínima: impossível e já garantido", () => {
  assert.equal(calculateSemesters(media(0), nn(0, null, 90), null).target!.min, null);
  assert.equal(calculateSemesters(media(10), nn(10, null, 90), null).target!.min, 0);
});
test("sem nota nenhuma ou com tudo lançado não há nota mínima", () => {
  assert.equal(calculateSemesters(media(null), nn(null, null), null).target, null);
  assert.equal(notes(10, 9, 7, 8).target, null);
});

test("número acima de 10 sem vírgula ganha a vírgula depois do primeiro dígito", () => {
  assert.equal(autoComma("87"), "8,7");
  assert.equal(autoComma("875"), "8,75");
  assert.equal(autoComma("11"), "1,1");
  assert.equal(autoComma("10"), "10");
  assert.equal(autoComma("9"), "9");
  assert.equal(autoComma("8,7"), "8,7");
  assert.equal(autoComma("05"), "05");
});
