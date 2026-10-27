import test from "node:test";
import assert from "node:assert/strict";
import { calculate } from "./grades.ts";

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
