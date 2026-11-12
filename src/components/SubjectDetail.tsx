import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowLeft, Copy, Lock, RotateCcw, Scale, Target } from "lucide-react";
import { DEFAULT_N1_WEIGHT, describeTarget, fmt, type InputMode, type Modes, type NotesResult } from "../lib/grades";
import { useTween } from "../lib/useTween";
import { GradeInput, SITUATION, targetTone, type Grades } from "./SubjectRow";

const MIN_WEIGHT = 10;
const MAX_WEIGHT = 90;
const STEP = 5;

interface SemesterCardProps {
  title: string;
  subject: string;
  mode: InputMode;
  weight: number;
  n1: string;
  n2: string;
  avgInput: string;
  avg: number | null;
  onN1: (v: string) => void;
  onN2: (v: string) => void;
  onAvg: (v: string) => void;
  /** É o semestre cujo peso está na barra. */
  selected: boolean;
  onSelect: () => void;
}

function SemesterCard({ title, subject, mode, weight, n1, n2, avgInput, avg, onN1, onN2, onAvg, selected, onSelect }: SemesterCardProps) {
  const avgCls = avg !== null && avg < 7 ? "text-chip-red-ink" : avg === null ? "text-muted" : "text-ink";
  return (
    <section
      onFocusCapture={onSelect}
      className={`rounded-2xl bg-white p-4 shadow-card ring-2 transition-shadow duration-300 sm:p-5 ${
        selected && mode === "notas" ? "ring-brand/40" : "ring-transparent"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {mode === "notas" && (
          <span key={fmt(avg)} className={`animate-pop text-2xl font-bold tabular-nums ${avgCls}`}>
            {fmt(avg)}
          </span>
        )}
      </div>
      {mode === "media" ? (
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-muted">Média do semestre</span>
          <GradeInput label={`Média do ${title} de ${subject}`} placeholder="Média" value={avgInput} onChange={onAvg} className="w-full" />
        </label>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label>
              <span key={weight} className="mb-1 block animate-pop text-xs font-medium text-brand">
                N1 · {weight}%
              </span>
              <GradeInput label={`N1 do ${title} de ${subject}`} placeholder="N1" value={n1} onChange={onN1} className="w-full" />
            </label>
            <label>
              <span key={weight} className="mb-1 block animate-pop text-xs font-medium text-chip-orange-ink">
                N2 · {100 - weight}%
              </span>
              <GradeInput label={`N2 do ${title} de ${subject}`} placeholder="N2" value={n2} onChange={onN2} className="w-full" />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-muted tabular-nums">
            N1 × {weight}% + N2 × {100 - weight}% = <span className="font-semibold text-ink">{fmt(avg)}</span>
          </p>
        </>
      )}
    </section>
  );
}

const SEMESTERS = ["1º semestre", "2º semestre"] as const;
const TICKS = [10, 20, 30, 40, 50, 60, 70, 80, 90];
const clampWeight = (v: number) => Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, v));
// Deslizar com um leve "quique" ao soltar; enquanto arrasta, segue o dedo quase sem atraso.
const SPRING = "duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]";

interface WeightCardProps {
  weights: [number, number];
  /** Semestres lançados como N1 e N2; os de média não têm peso. */
  enabled: [boolean, boolean];
  semester: 0 | 1;
  onSemester: (s: 0 | 1) => void;
  onChange: (semester: 0 | 1, v: number) => void;
}

/**
 * Barra do peso: o pedaço azul é a N1 e o laranja a N2, cada um do tamanho do seu peso.
 * Arrasta (ou usa as setas do teclado) para mudar; as abas escolhem qual semestre está sendo ajustado.
 */
function WeightCard({ weights, enabled, semester, onSemester, onChange }: WeightCardProps) {
  const value = weights[semester];
  const otherSemester = semester === 0 ? 1 : 0;
  const shown = Math.round(useTween(value));
  const bar = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const motion = dragging ? "duration-75" : SPRING;

  const set = (v: number) => {
    const next = clampWeight(v);
    if (next === value) return;
    // Um toque leve no celular ao passar pelo 50/50, para dar para "sentir" o meio.
    if (next === DEFAULT_N1_WEIGHT) navigator.vibrate?.(8);
    onChange(semester, next);
  };
  const fromPointer = (x: number) => {
    const r = bar.current!.getBoundingClientRect();
    return Math.round((((x - r.left) / r.width) * 100) / STEP) * STEP;
  };
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: value - STEP,
      ArrowDown: value - STEP,
      ArrowRight: value + STEP,
      ArrowUp: value + STEP,
      PageDown: value - 2 * STEP,
      PageUp: value + 2 * STEP,
      Home: MIN_WEIGHT,
      End: MAX_WEIGHT,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    set(moves[e.key]);
  };

  return (
    <section className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Scale size={18} aria-hidden className="text-brand" /> Peso das notas
        </h2>
        {value !== DEFAULT_N1_WEIGHT && (
          <button
            onClick={() => set(DEFAULT_N1_WEIGHT)}
            className="flex h-8 animate-pop cursor-pointer items-center gap-1.5 rounded-lg bg-black/5 px-2.5 text-xs font-medium text-muted outline-none transition-colors hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-brand"
          >
            <RotateCcw size={13} aria-hidden /> Voltar para 50/50
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">Escolha o semestre e arraste a barra para mudar quanto a N1 e a N2 valem.</p>

      {/* Abas dos semestres, com um fundo que desliza até a aba escolhida. */}
      <div className="relative mt-4 grid grid-cols-2 rounded-xl bg-page p-1" role="tablist" aria-label="Semestre do peso">
        <span
          aria-hidden
          className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-white shadow-card transition-transform ${SPRING}`}
          style={{ transform: `translateX(${semester * 100}%)` }}
        />
        {SEMESTERS.map((title, i) => {
          const w = weights[i];
          return (
            <button
              key={title}
              role="tab"
              aria-selected={semester === i}
              disabled={!enabled[i]}
              onClick={() => onSemester(i as 0 | 1)}
              className={`relative flex h-12 cursor-pointer flex-col items-center justify-center rounded-lg text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50 ${
                semester === i ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {title}
              <span className={`text-[11px] font-medium tabular-nums ${enabled[i] && w !== DEFAULT_N1_WEIGHT ? "text-brand" : "text-muted"}`}>
                {enabled[i] ? `N1 ${w}% · N2 ${100 - w}%` : "Lançado pela média"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Os números "correm" até o novo valor e o lado que pesa mais fica maior. */}
      <div className="mt-5 flex items-end justify-between">
        <div>
          <span className="block text-xs font-semibold text-muted">N1</span>
          <span
            className="inline-block origin-bottom-left text-4xl font-bold text-brand tabular-nums transition-transform duration-300"
            style={{ transform: `scale(${0.8 + (value / 100) * 0.4})` }}
          >
            {shown}%
          </span>
        </div>
        <div className="text-right">
          <span className="block text-xs font-semibold text-muted">N2</span>
          <span
            className="inline-block origin-bottom-right text-4xl font-bold text-chip-orange-ink tabular-nums transition-transform duration-300"
            style={{ transform: `scale(${0.8 + ((100 - value) / 100) * 0.4})` }}
          >
            {100 - shown}%
          </span>
        </div>
      </div>

      <div
        ref={bar}
        className="relative mt-2 h-14 cursor-grab touch-pan-y select-none active:cursor-grabbing"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          set(fromPointer(e.clientX));
        }}
        onPointerMove={(e) => dragging && set(fromPointer(e.clientX))}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <div
          className={`absolute inset-x-0 top-1/2 flex -translate-y-1/2 overflow-hidden rounded-xl transition-[height] duration-200 ${dragging ? "h-12" : "h-10"}`}
        >
          <div
            className={`relative flex items-center overflow-hidden bg-brand pl-3 text-xs font-semibold whitespace-nowrap text-white transition-[width] ${motion}`}
            style={{ width: `${value}%` }}
          >
            {value >= 20 && "N1"}
          </div>
          <div className="relative flex flex-1 items-center justify-end overflow-hidden bg-chip-orange-ink pr-3 text-xs font-semibold whitespace-nowrap text-white">
            {value <= 80 && "N2"}
          </div>
          {/* Brilho que passa pela barra enquanto arrasta. */}
          {dragging && (
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          )}
        </div>

        {/* Alça na divisa entre N1 e N2, com um balão do valor enquanto arrasta. */}
        <div
          role="slider"
          tabIndex={0}
          aria-label={`Peso da N1 no ${SEMESTERS[semester]}`}
          aria-valuemin={MIN_WEIGHT}
          aria-valuemax={MAX_WEIGHT}
          aria-valuenow={value}
          aria-valuetext={`N1 ${value}%, N2 ${100 - value}%`}
          onKeyDown={onKey}
          className={`absolute top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-ink shadow-lg outline-none transition-[left,scale] focus-visible:ring-4 focus-visible:ring-brand/30 ${motion} ${
            dragging ? "scale-125" : "hover:scale-110"
          }`}
          style={{ left: `${value}%` }}
        >
          <span aria-hidden className="h-3.5 w-0.5 rounded-full bg-white/80" />
          <span
            aria-hidden
            className={`pointer-events-none absolute bottom-full mb-2.5 rounded-md bg-ink px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-white tabular-nums shadow-md transition-[opacity,translate] duration-200 ${
              dragging ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
            }`}
          >
            {value}/{100 - value}
          </span>
        </div>
      </div>

      {/* Marcas de 10 em 10; acende a que está no valor atual. */}
      <div className="relative h-6">
        {TICKS.map((t) => (
          <span
            key={t}
            aria-hidden
            className={`absolute top-0 flex -translate-x-1/2 flex-col items-center gap-0.5 text-[10px] tabular-nums transition-[color,scale] duration-200 ${
              t === value ? "scale-125 font-bold text-ink" : t === DEFAULT_N1_WEIGHT ? "text-muted" : "text-muted/50"
            }`}
            style={{ left: `${t}%` }}
          >
            <span className={`h-1.5 w-px ${t === DEFAULT_N1_WEIGHT ? "bg-muted" : "bg-line"}`} />
            {t === DEFAULT_N1_WEIGHT ? "50/50" : t}
          </span>
        ))}
      </div>

      {enabled[otherSemester] && value !== weights[otherSemester] && (
        <button
          onClick={() => onChange(otherSemester, value)}
          className="mt-3 flex h-10 w-full animate-fade-up cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand/40 text-xs font-medium text-brand outline-none transition-colors hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Copy size={13} aria-hidden /> Usar {value}/{100 - value} também no {SEMESTERS[otherSemester]}
        </button>
      )}
    </section>
  );
}

interface Props {
  name: string;
  modes: Modes;
  grades: Grades;
  result: NotesResult;
  onChange: (patch: Partial<Grades>) => void;
  onClose: () => void;
}

/** Tela da disciplina: tudo da linha da tabela, maior, mais o peso da N1 e da N2. */
export function SubjectDetail({ name, modes, grades: g, result: r, onChange, onClose }: Props) {
  const back = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    back.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Semestre cujo peso aparece na barra.
  const enabled: [boolean, boolean] = [modes.s1 === "notas", modes.s2 === "notas"];
  const [semester, setSemester] = useState<0 | 1>(enabled[0] ? 0 : 1);
  const target = r.situation === "andamento" ? r.target : null;
  const sit = SITUATION[r.situation];
  const showRec = r.situation === "recuperacao" || r.situation === "reprovado" || r.final !== null;
  const annualCls = r.annual !== null && r.annual < 7 ? "text-chip-red-ink" : r.annual === null ? "text-muted" : "text-ink";

  return (
    <div role="dialog" aria-modal="true" aria-label={name} className="fixed inset-0 z-30 overflow-y-auto bg-page">
      <header className="sticky top-0 z-10 bg-brand text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-2 px-4">
          <button
            ref={back}
            onClick={onClose}
            aria-label="Voltar para as disciplinas"
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full outline-none transition-[background-color,transform] hover:bg-white/15 active:scale-95 focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowLeft size={22} aria-hidden />
          </button>
          <span className="truncate font-semibold">{name}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl animate-fade-up space-y-4 px-4 py-6">
        <section className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-card">
          <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${sit.bar}`} />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-lg leading-snug font-semibold sm:text-xl">{name}</h1>
              <span
                key={r.situation}
                className={`mt-2 inline-flex h-8 animate-pop items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ${sit.chip}`}
              >
                <sit.Icon size={14} aria-hidden /> {sit.text}
              </span>
            </div>
            <div className="shrink-0 text-right">
              <span className="block text-xs font-medium text-muted">Média anual</span>
              <span key={fmt(r.annual)} className={`block animate-pop text-4xl font-bold tabular-nums ${annualCls}`}>
                {fmt(r.annual)}
              </span>
              {r.recovered !== null && <span className="text-xs text-chip-red-ink">rec. {fmt(r.recovered)}</span>}
            </div>
          </div>
        </section>

        {target && (
          <section className={`flex items-start gap-3 rounded-2xl p-4 shadow-card sm:p-5 ${targetTone(target)}`}>
            <Target size={20} aria-hidden className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-semibold">Para passar direto</h2>
              <p key={describeTarget(target)} className="animate-fade-up text-sm">
                {describeTarget(target)}
                {target.min !== null && target.min > 0 && target.missing.length > 1 && ` (${target.missing.join(", ")})`}
              </p>
              <p className="mt-1 text-xs opacity-80">Considera a média anual 7 sem recuperação, com a média recuperada quando ela ajuda.</p>
            </div>
          </section>
        )}

        {enabled[0] || enabled[1] ? (
          <WeightCard
            weights={[g.s1Weight, g.s2Weight]}
            enabled={enabled}
            semester={semester}
            onSemester={setSemester}
            onChange={(s, w) => onChange(s === 0 ? { s1Weight: w } : { s2Weight: w })}
          />
        ) : (
          <p className="rounded-2xl bg-white p-4 text-sm text-muted shadow-card">
            O peso da N1 e da N2 só vale nos semestres lançados como "N1 e N2".
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <SemesterCard
            title="1º semestre"
            subject={name}
            mode={modes.s1}
            weight={g.s1Weight}
            selected={semester === 0}
            onSelect={() => setSemester(0)}
            n1={g.s1n1}
            n2={g.s1n2}
            avgInput={g.s1avg}
            avg={r.m1}
            onN1={(v) => onChange({ s1n1: v })}
            onN2={(v) => onChange({ s1n2: v })}
            onAvg={(v) => onChange({ s1avg: v })}
          />
          <SemesterCard
            title="2º semestre"
            subject={name}
            mode={modes.s2}
            weight={g.s2Weight}
            selected={semester === 1}
            onSelect={() => setSemester(1)}
            n1={g.s2n1}
            n2={g.s2n2}
            avgInput={g.s2avg}
            avg={r.m2}
            onN1={(v) => onChange({ s2n1: v })}
            onN2={(v) => onChange({ s2n2: v })}
            onAvg={(v) => onChange({ s2avg: v })}
          />
        </div>

        <section className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
          <h2 className="font-semibold">Recuperação final</h2>
          {showRec ? (
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <label className="w-32">
                <span className="mb-1 block text-xs font-medium text-muted">Nota da rec.</span>
                <GradeInput label={`Recuperação final de ${name}`} value={g.rec} onChange={(v) => onChange({ rec: v })} className="w-full" />
              </label>
              <div className="pb-2 text-sm">
                {r.final !== null ? (
                  <>
                    Média final <span className={`font-bold tabular-nums ${r.final < 6 ? "text-chip-red-ink" : ""}`}>{fmt(r.final)}</span>
                  </>
                ) : r.needed !== null ? (
                  <span className="text-chip-orange-ink">
                    {r.needed > 10 ? "Não é mais possível passar" : `Precisa de ${fmt(r.needed)} na recuperação`}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              <Lock size={14} aria-hidden /> Libera quando a média anual ficar abaixo de 7.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
