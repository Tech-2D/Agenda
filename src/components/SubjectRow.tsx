import { useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock, Lock, ShieldCheck, XCircle } from "lucide-react";
import { fmt, parseGrade, type Result, type Situation } from "../lib/grades";

export interface Grades {
  m1: string;
  m2: string;
  rec: string;
}

export const GRID = "lg:grid-cols-[minmax(0,2.6fr)_repeat(5,minmax(0,1fr))_minmax(0,1.35fr)] lg:items-center lg:gap-4";

export const SITUATION: Record<Situation, { text: string; chip: string; bar: string; Icon: typeof Clock }> = {
  aprovado: { text: "Aprovado", chip: "bg-chip-green text-chip-green-ink", bar: "bg-chip-green-ink", Icon: CheckCircle2 },
  "aprovado-rec": { text: "Aprovado na rec.", chip: "bg-chip-purple text-chip-purple-ink", bar: "bg-chip-purple-ink", Icon: ShieldCheck },
  recuperacao: { text: "Recuperação", chip: "bg-chip-orange text-chip-orange-ink", bar: "bg-chip-orange-ink", Icon: AlertTriangle },
  reprovado: { text: "Reprovado", chip: "bg-chip-red text-chip-red-ink", bar: "bg-chip-red-ink", Icon: XCircle },
  andamento: { text: "Em andamento", chip: "bg-chip-blue text-chip-blue-ink", bar: "bg-chip-blue-ink", Icon: Clock },
  "sem-notas": { text: "Sem notas", chip: "bg-black/5 text-muted", bar: "bg-line", Icon: Clock },
};

export const toGrade = (v: string) => (v === "" ? null : parseGrade(v));

function Cell({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="mb-1 block text-[11px] font-medium text-muted lg:hidden">{label}</span>
      {children}
    </div>
  );
}

// Até dois dígitos inteiros e duas casas decimais, com vírgula ou ponto.
const GRADE_FORMAT = /^\d{0,2}([.,]\d{0,2})?$/;

export function GradeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [error, setError] = useState(false);
  const timer = useRef<number>(undefined);

  const reject = () => {
    setError(false);
    // Reinicia no próximo frame para a animação de "tremida" rodar de novo a cada tentativa.
    requestAnimationFrame(() => setError(true));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setError(false), 1600);
  };

  return (
    <span className="relative block w-full lg:max-w-24">
      <input
        aria-label={label}
        aria-invalid={error}
        inputMode="decimal"
        placeholder="-"
        value={value}
        onChange={(e) => {
          const next = e.target.value.replace(/\s/g, "");
          const n = parseFloat(next.replace(",", "."));
          // Nota vai de 0 a 10: qualquer coisa acima disso é recusada já na digitação.
          if (!GRADE_FORMAT.test(next) || n > 10) return reject();
          setError(false);
          onChange(next);
        }}
        onBlur={() => {
          const n = toGrade(value);
          if (n !== null) onChange(n.toFixed(2).replace(".", ","));
        }}
        className={`h-11 w-full rounded-lg border bg-white px-2 text-center text-sm tabular-nums outline-none transition-[border-color,box-shadow,transform] duration-200 focus:scale-105 ${
          error
            ? "animate-shake border-chip-red-ink ring-4 ring-chip-red-ink/15"
            : "border-line hover:border-brand/40 focus:border-brand focus:ring-4 focus:ring-brand/15"
        }`}
      />
      {error && (
        <span
          role="alert"
          className="absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 animate-pop whitespace-nowrap rounded-md bg-chip-red-ink px-2 py-1 text-[11px] font-medium text-white shadow-md"
        >
          Nota máxima é 10
        </span>
      )}
    </span>
  );
}

/** Valor calculado: a cada mudança o número "pula" e a célula pisca de leve. */
const Value = ({ n, min }: { n: number | null; min: number }) => (
  <span
    key={fmt(n)}
    className={`-mx-1.5 inline-flex h-11 animate-flash items-center rounded-md px-1.5 text-sm font-medium tabular-nums ${
      n !== null && n < min ? "text-chip-red-ink" : ""
    }`}
  >
    <span className="animate-pop">{fmt(n)}</span>
  </span>
);

interface Props {
  name: string;
  grades: Grades;
  result: Result;
  index: number;
  onChange: (patch: Partial<Grades>) => void;
}

/*
 * Um único conjunto de campos com dois layouts:
 * - celular: card com nome + média anual em destaque, os três campos lado a lado e um rodapé de status;
 * - desktop (lg): linha da tabela, reordenada com lg:order-*.
 */
export function SubjectRow({ name, grades: g, result: r, index, onChange }: Props) {
  const sit = SITUATION[r.situation];
  const showRec = r.situation === "recuperacao" || r.situation === "reprovado" || r.final !== null;
  const lowAnnual = r.annual !== null && r.annual < 7;

  const footer =
    r.final !== null
      ? { text: `Média final ${fmt(r.final)}`, cls: r.final < 6 ? "bg-chip-red text-chip-red-ink" : sit.chip }
      : r.needed !== null
        ? {
            text: r.needed > 10 ? "Não é mais possível passar" : `Precisa de ${fmt(r.needed)} na recuperação`,
            cls: "bg-chip-orange text-chip-orange-ink",
          }
        : null;

  const chip = (
    <span
      key={r.situation}
      className={`inline-flex h-8 animate-pop items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium ${sit.chip}`}
    >
      <sit.Icon size={14} aria-hidden /> {sit.text}
    </span>
  );

  return (
    <li
      style={{ animationDelay: `${Math.min(index * 40, 600)}ms` }}
      className={`group relative grid animate-fade-up grid-cols-3 gap-x-3 gap-y-3 overflow-hidden rounded-xl bg-white p-4 pl-5 shadow-card transition-[box-shadow,transform,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-md lg:rounded-none lg:px-4 lg:py-2 lg:pl-5 lg:shadow-none lg:hover:translate-y-0 lg:hover:bg-brand-soft/60 lg:hover:shadow-none ${GRID}`}
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 transition-[background-color,width] duration-300 group-hover:w-1.5 ${sit.bar}`}
      />

      <div className="col-span-2 flex min-w-0 flex-col items-start gap-2 lg:order-1 lg:col-span-1">
        <h3 className="text-[15px] leading-snug font-semibold lg:text-sm lg:font-medium">{name}</h3>
        {r.situation !== "sem-notas" && <div className="lg:hidden">{chip}</div>}
      </div>

      {/* Média anual: destaque no canto do card no celular, célula comum na tabela. */}
      <div className="flex flex-col items-end text-right lg:order-4 lg:items-start lg:text-left">
        <span className="text-[11px] font-medium text-muted lg:hidden">Média anual</span>
        <span
          key={fmt(r.annual)}
          className={`animate-pop text-2xl leading-tight font-bold tabular-nums lg:flex lg:h-11 lg:items-center lg:text-sm lg:font-medium ${
            lowAnnual ? "text-chip-red-ink" : r.annual === null ? "text-muted" : "text-ink"
          }`}
        >
          {fmt(r.annual)}
        </span>
        {r.recovered !== null && (
          <span className="animate-pop text-[11px] text-chip-red-ink lg:-mt-2">rec. {fmt(r.recovered)}</span>
        )}
      </div>

      <div className="col-span-3 grid grid-cols-3 gap-2 rounded-xl bg-page p-2 lg:contents">
        <Cell label="1º Sem" className="lg:order-2">
          <GradeInput label={`Média 1º semestre de ${name}`} value={g.m1} onChange={(v) => onChange({ m1: v })} />
        </Cell>
        <Cell label="2º Sem" className="lg:order-3">
          <GradeInput label={`Média 2º semestre de ${name}`} value={g.m2} onChange={(v) => onChange({ m2: v })} />
        </Cell>
        <Cell label="Recuperação" className="lg:order-5">
          {showRec ? (
            <div className="animate-pop">
              <GradeInput label={`Recuperação final de ${name}`} value={g.rec} onChange={(v) => onChange({ rec: v })} />
              {r.needed !== null && r.final === null && (
                <span className="mt-1 hidden text-[11px] leading-tight text-chip-orange-ink lg:block">
                  {r.needed > 10 ? "Não é mais possível" : `Liberada! Precisa de ${fmt(r.needed)}`}
                </span>
              )}
            </div>
          ) : (
            <span
              title="Libera quando a média anual ficar abaixo de 7"
              className="flex h-11 w-full items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-white/60 text-muted lg:max-w-24"
            >
              <Lock size={14} aria-hidden />
              <span className="sr-only">Recuperação bloqueada: libera quando a média anual ficar abaixo de 7</span>
            </span>
          )}
        </Cell>
      </div>

      {/* Rodapé de status só no celular. */}
      {footer && (
        <p key={footer.text} className={`col-span-3 animate-fade-up rounded-lg px-3 py-2 text-xs font-medium lg:hidden ${footer.cls}`}>
          {footer.text}
        </p>
      )}

      <div className="hidden lg:order-6 lg:block">
        <Value n={r.final} min={6} />
      </div>
      <div className="hidden lg:order-7 lg:block">{r.situation === "sem-notas" ? <span className="text-sm">-</span> : chip}</div>
    </li>
  );
}
