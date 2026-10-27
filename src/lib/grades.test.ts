import test from "node:test";
import assert from "node:assert/strict";
import { calculate, calculateFromAverages, calculateFromNotes, semesterAverage } from "./grades.ts";

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
