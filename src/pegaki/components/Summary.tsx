import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Flag, PartyPopper, Sparkles, Target } from "lucide-react";
import { fmt, type NotesResult, type Situation } from "../lib/grades";
import { useTween } from "../lib/useTween";
import { SITUATION } from "./SubjectRow";

// Ordem da barra e da legenda: do melhor para o pior, e "sem notas" no fim.
const ORDER: Situation[] = ["aprovado", "aprovado-rec", "andamento", "recuperacao", "reprovado", "sem-notas"];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface SummaryRow {
  name: string;
  r: NotesResult;
}

/** Já passou, ou fecha com 7 mesmo tirando 0 no que falta. */
const secured = (r: NotesResult) =>
  r.situation === "aprovado" || r.situation === "aprovado-rec" || (r.situation === "andamento" && r.target?.min === 0);

/** Na recuperação, reprovado, ou nem com 10 no que falta chega a 7. */
const atRisk = (r: NotesResult) =>
  r.situation === "recuperacao" || r.situation === "reprovado" || (r.situation === "andamento" && r.target?.min === null);

function Stat({ label, icon, children, sub }: { label: string; icon: ReactNode; children: ReactNode; sub: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-page p-3 sm:p-4">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon}
        {label}
      </span>
      <div className="mt-1 text-2xl leading-tight font-semibold text-ink">{children}</div>
      <p className="mt-0.5 text-xs leading-snug text-muted">{sub}</p>
    </div>
  );
}

export function Summary({ rows, action }: { rows: SummaryRow[]; action?: ReactNode }) {
  const total = rows.length;
  const results = rows.map((x) => x.r);
  const counts = Object.fromEntries(ORDER.map((s) => [s, results.filter((r) => r.situation === s).length])) as Record<Situation, number>;
  const graded = total - counts["sem-notas"];
  const safe = results.filter(secured).length;
  const risk = rows.filter((x) => atRisk(x.r));
  const shownSafe = Math.round(useTween(safe));

  // A meta mais difícil: a maior nota mínima que ainda falta tirar para passar direto.
  const hardest = rows
    .filter((x) => x.r.situation === "andamento" && x.r.target?.min)
    .sort((a, b) => b.r.target!.min! - a.r.target!.min!)[0];

  const passed = total > 0 && counts.aprovado + counts["aprovado-rec"] === total;
  const verdict =
    graded === 0
      ? { Icon: Sparkles, title: "Comece lançando suas notas", sub: "As médias e o que falta para passar aparecem na hora." }
      : counts.reprovado > 0
        ? {
            Icon: AlertTriangle,
            title: "Atenção: há reprovação",
            sub: `${plural(counts.reprovado, "disciplina ficou", "disciplinas ficaram")} abaixo de 6 na média final.`,
          }
        : risk.length > 0
          ? {
              Icon: Flag,
              title: "Fique de olho",
              sub: `${plural(risk.length, "disciplina está", "disciplinas estão")} em risco de recuperação.`,
            }
          : passed
            ? { Icon: PartyPopper, title: "Você passou de ano!", sub: "Todas as disciplinas aprovadas." }
            : counts.andamento > 0
              ? {
                  Icon: CheckCircle2,
                  title: "No caminho certo",
                  sub: `Nenhuma disciplina em risco. ${plural(counts.andamento, "ainda tem", "ainda têm")} nota por lançar.`,
                }
              : {
                  Icon: CheckCircle2,
                  title: "Tudo certo até aqui",
                  sub: `Faltam ${plural(counts["sem-notas"], "disciplina", "disciplinas")} para lançar.`,
                };

  const barLabel = ORDER.filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${s === "sem-notas" ? "sem notas" : SITUATION[s].text.toLowerCase()}`)
    .join(", ");

  return (
    <section
      className="animate-fade-up rounded-2xl bg-surface p-4 shadow-card sm:p-6"
      style={{ animationDelay: "60ms" }}
      aria-label="Resumo do ano"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div key={verdict.title} className="flex min-w-0 animate-fade-up items-start gap-3">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-xl ${passed ? "animate-glow bg-chip-green-ink text-surface" : "bg-brand-soft text-brand-ink"}`}
          >
            <verdict.Icon size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold sm:text-lg">{verdict.title}</h2>
            <p className="text-sm text-muted">{verdict.sub}</p>
          </div>
        </div>
        {/* No celular as ações descem para baixo do título; a última (principal) ocupa o espaço que sobra. */}
        {action && (
          <div className="flex w-full gap-2 sm:w-auto [&>button:last-child]:flex-1 [&>button:last-child]:justify-center sm:[&>button:last-child]:flex-none">
            {action}
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
        {/* Número principal: quantas disciplinas já estão garantidas. */}
        <div className="col-span-full flex items-end gap-3 rounded-xl bg-brand p-4 text-on-brand sm:col-span-1">
          <span className="text-5xl leading-none font-semibold">{shownSafe}</span>
          <span className="pb-1 text-sm leading-tight text-on-brand/80">
            de {total} disciplinas
            <span className="block font-medium text-on-brand">garantidas</span>
          </span>
        </div>
        <div className="col-span-full grid grid-cols-2 gap-3 sm:contents">
          <Stat
            label="Em risco"
            icon={<AlertTriangle size={14} aria-hidden />}
            sub={risk.length ? "recuperação ou abaixo de 7" : "nenhuma por enquanto"}
          >
            <span className={risk.length ? "text-chip-red-ink" : ""}>{risk.length}</span>
          </Stat>
          <Stat
            label="Meta mais difícil"
            icon={<Target size={14} aria-hidden />}
            sub={
              hardest ? (
                <span className="line-clamp-2" title={hardest.name}>
                  {hardest.r.target!.missing.length === 1 ? `na ${hardest.r.target!.missing[0]}` : "em cada nota que falta"} de{" "}
                  {hardest.name}
                </span>
              ) : (
                "nada pendente para passar"
              )
            }
          >
            {hardest ? fmt(hardest.r.target!.min) : "-"}
          </Stat>
        </div>
      </div>

      {/* Barra de situações: um segmento por situação, com 2px de respiro entre eles. */}
      <div className="mt-5 flex h-2 gap-0.5" role="img" aria-label={`Situação das ${total} disciplinas: ${barLabel}`}>
        {ORDER.filter((s) => counts[s] > 0).map((s) => (
          <span
            key={s}
            title={`${s === "sem-notas" ? "Sem notas" : SITUATION[s].text}: ${counts[s]}`}
            className={`h-full rounded-full transition-[flex-grow] duration-700 ease-out ${SITUATION[s].bar}`}
            style={{ flexGrow: counts[s], flexBasis: 0 }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        {ORDER.map((s) => {
          const { Icon, text, bar } = SITUATION[s];
          return (
            <li key={s} className="flex items-center gap-1.5">
              <span aria-hidden className={`size-2 rounded-full ${bar}`} />
              <Icon size={12} aria-hidden className="shrink-0" />
              {s === "sem-notas" ? "Sem notas" : text}
              <span key={counts[s]} className="inline-block animate-pop font-semibold text-ink tabular-nums">
                {counts[s]}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
