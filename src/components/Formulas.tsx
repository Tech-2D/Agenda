import { useState, type ReactNode } from "react";
import { calculateFromNotes, describeTarget, fmt } from "../lib/grades";
import { useInView } from "../lib/useInView";
import { GradeInput, SITUATION, toGrade } from "./SubjectRow";

type Tone = "blue" | "orange" | "green" | "red";
const tones: Record<Tone, string> = {
  blue: "bg-chip-blue text-chip-blue-ink",
  orange: "bg-chip-orange text-chip-orange-ink",
  green: "bg-chip-green text-chip-green-ink",
  red: "bg-chip-red text-chip-red-ink",
};

/** Chip da fórmula; quando há um valor do simulador, ele aparece embaixo do nome. */
function Chip({ tone, children, value }: { tone: Tone; children: ReactNode; value?: number | null }) {
  return (
    <span
      className={`inline-flex flex-col items-center rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-transform duration-200 hover:-translate-y-0.5 ${tones[tone]}`}
    >
      {children}
      {value != null && (
        <span key={fmt(value)} className="animate-pop text-base leading-tight font-semibold tabular-nums">
          {fmt(value)}
        </span>
      )}
    </span>
  );
}

const Op = ({ children }: { children: ReactNode }) => <span className="px-1 text-lg text-ink">{children}</span>;

function Fraction({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <div className="flex flex-wrap items-center justify-center gap-1 border-b border-ink px-2 pb-3">{top}</div>
      <span className="pt-2 text-sm">{bottom}</span>
    </div>
  );
}

function Card({
  className = "",
  delay = 0,
  dim = false,
  children,
}: {
  className?: string;
  delay?: number;
  dim?: boolean;
  children: ReactNode;
}) {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <section
      ref={ref}
      style={{ transitionDelay: inView ? `${delay}ms` : undefined }}
      className={`reveal rounded-xl border bg-white p-3 transition-[opacity,transform,border-color,box-shadow] sm:p-4 ${inView ? "in" : ""} ${
        dim ? "border-line [&.in]:opacity-55" : "border-line hover:border-brand/30 hover:shadow-md"
      } ${className}`}
    >
      {children}
    </section>
  );
}

function Formula({ label, tone, value, fraction }: { label: string; tone: Tone; value?: number | null; fraction: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 py-2 sm:gap-4">
      <Chip tone={tone} value={value}>
        {label}
      </Chip>
      <Op>=</Op>
      {fraction}
    </div>
  );
}

export function Formulas() {
  const [sim, setSim] = useState({ s1n1: "", s1n2: "", s2n1: "", s2n2: "", rec: "" });
  const n = {
    s1n1: toGrade(sim.s1n1),
    s1n2: toGrade(sim.s1n2),
    s2n1: toGrade(sim.s2n1),
    s2n2: toGrade(sim.s2n2),
    rec: toGrade(sim.rec),
  };
  const r = calculateFromNotes(n);
  const { m1, m2, rec } = { m1: r.m1, m2: r.m2, rec: n.rec };
  const active = r.situation !== "sem-notas";
  const usedRec = r.recovered !== null;
  const inFinal = r.needed !== null;
  const sit = SITUATION[r.situation];

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4 rounded-xl bg-brand-soft p-4 text-center sm:p-5">
        <div>
          <p className="text-base font-semibold">Simule uma disciplina</p>
          <p className="text-sm text-muted">Digite as notas e veja a fórmula sendo preenchida.</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-end sm:justify-center sm:gap-3">
          {(
            [
              ["1º semestre", "s1n1", "s1n2"],
              ["2º semestre", "s2n1", "s2n2"],
            ] as const
          ).map(([title, k1, k2]) => (
            <fieldset key={title} className="min-w-0 rounded-lg bg-white/70 p-2">
              <legend className="sr-only">{title}</legend>
              <span aria-hidden className="mb-1 block text-[11px] font-medium text-muted">
                {title}
              </span>
              <div className="flex gap-1.5">
                {([k1, k2] as const).map((k, i) => (
                  <GradeInput
                    key={k}
                    label={`Simulação: N${i + 1} do ${title}`}
                    placeholder={`N${i + 1}`}
                    value={sim[k]}
                    onChange={(v) => setSim((s) => ({ ...s, [k]: v }))}
                    className="min-w-0 flex-1 sm:w-16 sm:flex-none"
                  />
                ))}
              </div>
            </fieldset>
          ))}
          <label className="min-w-0 rounded-lg bg-white/70 p-2">
            <span className="mb-1 block text-[11px] font-medium text-muted">Rec. Final</span>
            <GradeInput
              label="Simulação: Recuperação final"
              value={sim.rec}
              onChange={(v) => setSim((s) => ({ ...s, rec: v }))}
              className="w-full sm:w-16"
            />
          </label>
          {active && (
            <span
              key={r.situation}
              className={`inline-flex h-11 animate-pop items-center justify-center gap-1.5 self-end rounded-lg px-3 text-xs font-medium ${sit.chip}`}
            >
              <sit.Icon size={14} aria-hidden /> {sit.text}
            </span>
          )}
        </div>
        {r.situation === "andamento" && r.target && (
          <p key={describeTarget(r.target)} className="animate-fade-up text-sm font-medium text-chip-blue-ink">
            {describeTarget(r.target)}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card delay={0} className="md:col-span-2">
          <div className="grid gap-2 md:grid-cols-2">
            {(
              [
                ["Média 1º sem", m1, n.s1n1, n.s1n2],
                ["Média 2º sem", m2, n.s2n1, n.s2n2],
              ] as const
            ).map(([label, avg, n1, n2]) => (
              <Formula
                key={label}
                label={label}
                tone="blue"
                value={avg}
                fraction={
                  <Fraction
                    top={
                      <>
                        <Chip tone="blue" value={n1}>
                          N1
                        </Chip>
                        <Op>+</Op>
                        <Chip tone="blue" value={n2}>
                          N2
                        </Chip>
                      </>
                    }
                    bottom="2"
                  />
                }
              />
            ))}
          </div>
          <p className="mt-2 text-sm">
            Por padrão, a média de cada semestre é a média simples entre a N1 e a N2. Se o professor usa pesos diferentes (por exemplo, N1
            30% e N2 70%), toque no nome da disciplina e arraste o peso de cada semestre.
          </p>
        </Card>
        <Card delay={60}>
          <Formula
            label="Média Anual"
            tone="orange"
            value={r.annual}
            fraction={
              <Fraction
                top={
                  <>
                    <Chip tone={usedRec ? "red" : "blue"} value={usedRec ? r.recovered : m1}>
                      {usedRec ? "Média Recuperada" : "Média 1º sem"}
                    </Chip>
                    <Op>+</Op>
                    <Chip tone="blue" value={m2}>
                      Média 2º sem
                    </Chip>
                    <Op>×</Op>
                    <span>2</span>
                  </>
                }
                bottom="3"
              />
            }
          />
          <p className="mt-2 text-sm">A média anual deve ser igual ou superior a 7 para garantir a aprovação.</p>
        </Card>
        <Card delay={90} dim={active && !inFinal}>
          <Formula
            label="Média Final"
            tone="green"
            value={r.final}
            fraction={
              <Fraction
                top={
                  <>
                    <Chip tone="blue" value={inFinal ? rec : null}>
                      Recuperação Final
                    </Chip>
                    <Op>+</Op>
                    <Chip tone="orange" value={inFinal ? r.annual : null}>
                      Média Anual
                    </Chip>
                  </>
                }
                bottom="2"
              />
            }
          />
          <p className="mt-2 text-sm">
            A média final deve ser igual ou superior a 6 para garantir a aprovação.
            {inFinal && r.final === null && (
              <span className="mt-1 block animate-fade-up font-medium text-chip-orange-ink">
                {r.needed! > 10 ? "Não é mais possível passar." : `Você precisa de ${fmt(r.needed)} na recuperação final.`}
              </span>
            )}
          </p>
        </Card>
        <Card delay={180} dim={active && m2 !== null && !usedRec} className="md:col-span-2">
          <Formula
            label="Média Recuperada"
            tone="red"
            value={r.recovered}
            fraction={
              <Fraction
                top={
                  <>
                    <Chip tone="blue" value={usedRec ? m1 : null}>
                      Média 1º sem
                    </Chip>
                    <Op>+</Op>
                    <Chip tone="blue" value={usedRec ? m2 : null}>
                      Média 2º sem
                    </Chip>
                  </>
                }
                bottom="2"
              />
            }
          />
          <p className="mt-2 text-sm">
            A média recuperada ocorre quando a nota do 2º semestre supera a do 1º, passando a compor a média anual. O valor máximo da média
            recuperada é 7,00.
            {usedRec && (
              <span className="mt-1 block animate-fade-up font-medium text-chip-red-ink">
                Aplicada: ela substitui o 1º semestre no cálculo da média anual.
              </span>
            )}
          </p>
        </Card>
      </div>
    </div>
  );
}
