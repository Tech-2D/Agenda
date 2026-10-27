import { useEffect, useRef, useState } from "react";
import { fmt, type Result, type Situation } from "../lib/grades";
import { SITUATION } from "./SubjectRow";

const ORDER: Situation[] = ["aprovado", "aprovado-rec", "recuperacao", "reprovado", "andamento"];

function useAnimatedNumber(target: number | null) {
  const [value, setValue] = useState(target);
  const from = useRef(target ?? 0);

  useEffect(() => {
    if (target === null) return setValue(null);
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 450);
      const eased = 1 - (1 - p) ** 3;
      const v = origin + (target - origin) * eased;
      setValue(v);
      from.current = v;
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}

export function Summary({ results }: { results: Result[] }) {
  const graded = results.filter((r) => r.situation !== "sem-notas");
  const scores = graded.map((r) => r.final ?? r.annual!).filter((n) => n !== null);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const shown = useAnimatedNumber(avg);
  const counts = Object.fromEntries(ORDER.map((s) => [s, graded.filter((r) => r.situation === s).length])) as Record<Situation, number>;

  // Só dá para dizer que passou de ano quando todas as disciplinas foram lançadas e aprovadas.
  const missing = results.length - graded.length;
  const approved = counts.aprovado + counts["aprovado-rec"];
  const passed = results.length > 0 && approved === results.length;
  const verdict =
    graded.length === 0
      ? { title: "Comece digitando suas notas", sub: "O resultado aparece na hora." }
      : counts.reprovado > 0
        ? { title: "Atenção: há reprovação", sub: `${counts.reprovado} disciplina(s) abaixo de 6 na média final.` }
        : counts.recuperacao > 0
          ? { title: "Quase lá!", sub: `${counts.recuperacao} disciplina(s) em recuperação final.` }
          : counts.andamento > 0
            ? { title: "Ano em andamento", sub: "Lance o 2º semestre para ver o resultado." }
            : missing > 0
              ? { title: "Tudo certo até aqui", sub: `Faltam ${missing} disciplina(s) para lançar.` }
              : {
                  title: "Você passou de ano!",
                  sub: counts["aprovado-rec"]
                    ? `${counts["aprovado-rec"]} disciplina(s) aprovada(s) na recuperação.`
                    : "Todas as disciplinas aprovadas.",
                };

  return (
    <section
      className="grid animate-fade-up gap-4 rounded-2xl bg-white p-5 shadow-card sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8 sm:p-6"
      style={{ animationDelay: "60ms" }}
    >
      <div className="flex items-center gap-4">
        <div
          className={`grid size-16 shrink-0 place-items-center rounded-2xl text-white transition-colors duration-500 sm:size-20 ${
            passed ? "animate-glow bg-chip-green-ink" : "bg-brand shadow-lift"
          }`}
        >
          <span className="text-xl font-bold tabular-nums sm:text-2xl">{shown === null ? "-" : fmt(shown)}</span>
        </div>
        <div key={verdict.title} className="animate-fade-up sm:hidden">
          <p className="font-semibold">{verdict.title}</p>
          <p className="text-sm text-muted">{verdict.sub}</p>
        </div>
      </div>

      <div className="min-w-0 space-y-3">
        <div key={verdict.title} className="hidden animate-fade-up sm:block">
          <p className="text-lg font-semibold">{verdict.title}</p>
          <p className="text-sm text-muted">Média geral · {verdict.sub}</p>
        </div>

        <div className="relative flex h-2.5 overflow-hidden rounded-full bg-black/5" role="img" aria-label="Distribuição das situações">
          {ORDER.map((s) => (
            <span
              key={s}
              className={`h-full transition-[width] duration-700 ease-out ${SITUATION[s].bar}`}
              style={{ width: `${results.length ? (counts[s] / results.length) * 100 : 0}%` }}
            />
          ))}
          <span aria-hidden className="absolute inset-y-0 left-0 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        </div>

        <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {ORDER.map((s) => (
            <li key={s} className={`inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] leading-tight font-medium sm:px-2.5 sm:text-xs ${SITUATION[s].chip}`}>
              <span key={counts[s]} className="inline-block animate-pop font-semibold tabular-nums">
                {counts[s]}
              </span>{" "}
              {SITUATION[s].text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
