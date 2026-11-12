import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Lock, Scale, ShieldCheck, Target, XCircle } from "lucide-react";
import { DEFAULT_N1_WEIGHT, describeTarget, fmt, parseGrade, type InputMode, type Modes, type NotesResult, type PassTarget, type Situation } from "../lib/grades";

export interface Grades {
  s1n1: string;
  s1n2: string;
  s2n1: string;
  s2n2: string;
  s1avg: string;
  s2avg: string;
  rec: string;
  /** Peso da N1 em % em cada semestre; a N2 fica com o resto. */
  s1Weight: number;
  s2Weight: number;
}

export const GRID =
  "lg:grid-cols-[minmax(0,1.75fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.3fr)] lg:items-center lg:gap-4";

export const SITUATION: Record<Situation, { text: string; chip: string; bar: string; Icon: typeof Clock }> = {
  aprovado: { text: "Aprovado", chip: "bg-chip-green text-chip-green-ink", bar: "bg-chip-green-ink", Icon: CheckCircle2 },
  "aprovado-rec": { text: "Aprovado na rec.", chip: "bg-chip-purple text-chip-purple-ink", bar: "bg-chip-purple-ink", Icon: ShieldCheck },
  recuperacao: { text: "Recuperação", chip: "bg-chip-orange text-chip-orange-ink", bar: "bg-chip-orange-ink", Icon: AlertTriangle },
  reprovado: { text: "Reprovado", chip: "bg-chip-red text-chip-red-ink", bar: "bg-chip-red-ink", Icon: XCircle },
  andamento: { text: "Em andamento", chip: "bg-chip-blue text-chip-blue-ink", bar: "bg-chip-blue-ink", Icon: Clock },
  "sem-notas": { text: "Sem notas", chip: "bg-black/5 text-muted", bar: "bg-line", Icon: Clock },
};

export const toGrade = (v: string) => (v === "" ? null : parseGrade(v));

// Até dois dígitos inteiros e duas casas decimais, com vírgula ou ponto.
const GRADE_FORMAT = /^\d{0,2}([.,]\d{0,2})?$/;

interface GradeInputProps {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
  /** Rótulo pequeno no canto do campo, para saber qual nota é mesmo depois de preenchida (só no celular). */
  tag?: string;
}

export function GradeInput({ value, onChange, label, placeholder = "-", className = "w-full lg:max-w-24", tag }: GradeInputProps) {
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
    <span className={`relative block ${className}`}>
      <input
        aria-label={label}
        aria-invalid={error}
        inputMode="decimal"
        placeholder={placeholder}
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
        className={`h-11 w-full rounded-lg border bg-white px-1 text-center text-sm tabular-nums outline-none transition-[border-color,box-shadow,transform] duration-200 placeholder:text-muted/60 focus:scale-105 ${
          error
            ? "animate-shake border-chip-red-ink ring-4 ring-chip-red-ink/15"
            : "border-line hover:border-brand/40 focus:border-brand focus:ring-4 focus:ring-brand/15"
        }`}
      />
      {tag && value !== "" && (
        <span aria-hidden className="pointer-events-none absolute top-1 left-1.5 text-[9px] leading-none font-semibold text-muted lg:hidden">
          {tag}
        </span>
      )}
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

interface SemesterProps {
  title: string;
  subject: string;
  mode: InputMode;
  n1: string;
  n2: string;
  avgInput: string;
  avg: number | null;
  onN1: (v: string) => void;
  onN2: (v: string) => void;
  onAvg: (v: string) => void;
  className?: string;
}

/** N1, N2 e a média do semestre (ou só a média, no modo "media"): caixa própria no celular, célula da tabela no desktop. */
function Semester({ title, subject, mode, n1, n2, avgInput, avg, onN1, onN2, onAvg, className = "" }: SemesterProps) {
  const avgCls = avg !== null && avg < 7 ? "text-chip-red-ink" : avg === null ? "text-muted" : "text-ink";
  const short = title.replace("semestre", "sem.");
  if (mode === "media") {
    return (
      <div className={`min-w-0 rounded-xl bg-page p-2 lg:bg-transparent lg:p-0 ${className}`}>
        <div className="mb-1.5 px-0.5 text-[11px] font-semibold whitespace-nowrap text-muted lg:hidden">{short}</div>
        <GradeInput label={`Média do ${title} de ${subject}`} placeholder="Média" value={avgInput} onChange={onAvg} className="w-full lg:w-[9rem]" />
      </div>
    );
  }
  return (
    <div className={`min-w-0 rounded-xl bg-page p-2 lg:bg-transparent lg:p-0 ${className}`}>
      <div className="mb-1.5 flex items-center justify-between gap-1 px-0.5 whitespace-nowrap lg:hidden">
        <span className="text-[11px] font-semibold text-muted">{short}</span>
        <span key={fmt(avg)} className={`animate-pop text-sm font-bold tabular-nums ${avgCls}`}>
          {fmt(avg)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 lg:flex lg:items-center lg:gap-1.5">
        <GradeInput label={`N1 do ${title} de ${subject}`} tag="N1" placeholder="N1" value={n1} onChange={onN1} className="min-w-0 lg:w-[4.25rem]" />
        <GradeInput label={`N2 do ${title} de ${subject}`} tag="N2" placeholder="N2" value={n2} onChange={onN2} className="min-w-0 lg:w-[4.25rem]" />
        <span
          key={fmt(avg)}
          className={`hidden animate-pop text-sm font-semibold tabular-nums lg:ml-1 lg:inline ${avgCls}`}
          aria-label={`Média do ${title}`}
        >
          {fmt(avg)}
        </span>
      </div>
    </div>
  );
}

/** Cor da frase da nota mínima: verde se já garantiu, vermelho se nem com 10, azul no resto. */
export const targetTone = (t: PassTarget) =>
  t.min === null ? "bg-chip-red text-chip-red-ink" : t.min === 0 ? "bg-chip-green text-chip-green-ink" : "bg-chip-blue text-chip-blue-ink";

interface Props {
  name: string;
  modes: Modes;
  grades: Grades;
  result: NotesResult;
  index: number;
  onChange: (patch: Partial<Grades>) => void;
  /** Abre a tela da disciplina. */
  onOpen: () => void;
}

/*
 * Um único conjunto de campos com dois layouts:
 * - celular: card com nome + média anual em destaque, os dois semestres lado a lado,
 *   a recuperação embaixo e um rodapé de status;
 * - desktop (lg): linha da tabela, reordenada com lg:order-*.
 */
export function SubjectRow({ name, modes, grades: g, result: r, index, onChange, onOpen }: Props) {
  const sit = SITUATION[r.situation];
  const showRec = r.situation === "recuperacao" || r.situation === "reprovado" || r.final !== null;
  const lowAnnual = r.annual !== null && r.annual < 7;
  // Peso só conta nos semestres lançados como N1 e N2.
  const w1 = modes.s1 === "notas" ? g.s1Weight : DEFAULT_N1_WEIGHT;
  const w2 = modes.s2 === "notas" ? g.s2Weight : DEFAULT_N1_WEIGHT;
  const customWeight = w1 !== DEFAULT_N1_WEIGHT || w2 !== DEFAULT_N1_WEIGHT;
  // Nota mínima para passar direto, enquanto ainda falta nota.
  const target = r.situation === "andamento" ? r.target : null;

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
        <h3 className="text-[15px] leading-snug font-semibold lg:text-sm lg:font-medium">
          <button
            onClick={onOpen}
            className="group/name -mx-1 -my-0.5 cursor-pointer rounded-md px-1 py-0.5 text-left outline-none transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-brand"
          >
            {name}
            <ChevronRight
              size={16}
              aria-hidden
              className="ml-0.5 inline align-[-3px] text-muted transition-transform group-hover/name:translate-x-0.5 group-hover/name:text-brand"
            />
          </button>
        </h3>
        {(r.situation !== "sem-notas" || customWeight) && (
          <div className="flex flex-wrap items-center gap-2">
            {r.situation !== "sem-notas" && <div className="lg:hidden">{chip}</div>}
            {/* Só aparece quando o peso foi mudado; o ajuste em si fica na tela da disciplina. */}
            {customWeight && (
              <button
                onClick={onOpen}
                title="Peso da N1 e da N2: toque para ajustar"
                className="inline-flex h-7 animate-pop cursor-pointer items-center gap-1 rounded-lg bg-brand-soft px-2 text-[11px] font-medium text-brand tabular-nums outline-none hover:bg-brand/15 focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Scale size={13} aria-hidden />
                {modes.s1 === "media"
                  ? `2º N1 ${w2}% · N2 ${100 - w2}%`
                  : modes.s2 === "media"
                    ? `1º N1 ${w1}% · N2 ${100 - w1}%`
                    : w1 === w2
                      ? `N1 ${w1}% · N2 ${100 - w1}%`
                      : `1º ${w1}/${100 - w1} · 2º ${w2}/${100 - w2}`}
              </button>
            )}
          </div>
        )}
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
          <span title="O 2º semestre superou o 1º: a média dos dois (até 7,00) entra no lugar do 1º semestre na média anual" className="animate-pop text-[11px] leading-tight text-chip-red-ink lg:-mt-2">
            média recuperada {fmt(r.recovered)}
          </span>
        )}
      </div>

      <div className="col-span-3 grid grid-cols-2 gap-2 lg:contents">
        <Semester
          title="1º semestre"
          subject={name}
          mode={modes.s1}
          n1={g.s1n1}
          n2={g.s1n2}
          avgInput={g.s1avg}
          avg={r.m1}
          onN1={(v) => onChange({ s1n1: v })}
          onN2={(v) => onChange({ s1n2: v })}
          onAvg={(v) => onChange({ s1avg: v })}
          className="lg:order-2"
        />
        <Semester
          title="2º semestre"
          subject={name}
          mode={modes.s2}
          n1={g.s2n1}
          n2={g.s2n2}
          avgInput={g.s2avg}
          avg={r.m2}
          onN1={(v) => onChange({ s2n1: v })}
          onN2={(v) => onChange({ s2n2: v })}
          onAvg={(v) => onChange({ s2avg: v })}
          className="lg:order-3"
        />
      </div>

      {/* Recuperação final: libera só quando a média anual fica abaixo de 7. */}
      <div className="col-span-3 flex items-center justify-between gap-3 rounded-xl bg-page p-2 pl-3 lg:order-5 lg:col-span-1 lg:block lg:bg-transparent lg:p-0">
        <span className="text-xs font-semibold text-muted lg:hidden">Recuperação final</span>
        <div className="w-28 lg:w-auto">
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
        </div>
      </div>

      {/* Rodapé de status só no celular. */}
      {target && (
        <p
          key={describeTarget(target)}
          className={`col-span-3 flex animate-fade-up items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium lg:hidden ${targetTone(target)}`}
        >
          <Target size={14} aria-hidden className="shrink-0" /> {describeTarget(target)}
        </p>
      )}
      {footer && (
        <p key={footer.text} className={`col-span-3 animate-fade-up rounded-lg px-3 py-2 text-xs font-medium lg:hidden ${footer.cls}`}>
          {footer.text}
        </p>
      )}

      <div className="hidden lg:order-6 lg:block">
        <Value n={r.final} min={6} />
      </div>
      <div className="hidden lg:order-7 lg:block">
        {r.situation === "sem-notas" ? <span className="text-sm">-</span> : chip}
        {target && (
          <span
            key={describeTarget(target)}
            title={`Falta: ${target.missing.join(", ")}`}
            className={`mt-1 flex animate-pop items-start gap-1 text-[11px] leading-tight font-medium ${
              target.min === null ? "text-chip-red-ink" : target.min === 0 ? "text-chip-green-ink" : "text-chip-blue-ink"
            }`}
          >
            <Target size={12} aria-hidden className="mt-px shrink-0" /> {describeTarget(target, true)}
          </span>
        )}
      </div>
    </li>
  );
}
