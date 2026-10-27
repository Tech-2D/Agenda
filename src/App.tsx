import { useEffect, useMemo, useState } from "react";
import { ChevronDown, GraduationCap, LayoutGrid, Search } from "lucide-react";
import { calculateFromNotes, type Situation } from "./lib/grades";
import { useInView } from "./lib/useInView";
import { SUBJECTS_BY_YEAR, type Year } from "./data/subjects";
import { Formulas } from "./components/Formulas";
import { YearPicker } from "./components/YearPicker";
import { Summary } from "./components/Summary";
import { GRID, SITUATION, SubjectRow, toGrade, type Grades } from "./components/SubjectRow";

const YEAR_KEY = "aprovae:year";
const gradesKey = (y: Year) => `aprovae:v4:grades:${y}`;
const EMPTY: Grades = { s1n1: "", s1n2: "", s2n1: "", s2n2: "", rec: "" };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sem armazenamento: segue só em memória */
  }
}

type Filter = "todas" | Situation;
const FILTERS: Filter[] = ["todas", "aprovado", "aprovado-rec", "recuperacao", "reprovado", "andamento"];

const hasSubjects = (y: Year | null): y is Year => y !== null && SUBJECTS_BY_YEAR[y]?.length > 0;

export default function App() {
  const [year, setYear] = useState<Year | null>(() => {
    const saved = read<Year>(YEAR_KEY);
    return hasSubjects(saved) ? saved : null;
  });

  const pick = (y: Year | null) => {
    write(YEAR_KEY, y);
    setYear(y);
    window.scrollTo({ top: 0 });
  };

  if (!hasSubjects(year)) return <YearPicker onPick={pick} />;
  return <GradesView key={year} year={year} onChangeYear={() => pick(null)} />;
}

function GradesView({ year, onChangeYear }: { year: Year; onChangeYear: () => void }) {
  const subjects = SUBJECTS_BY_YEAR[year];
  // As notas ficam salvas pelo nome da disciplina; a lista em si é fixa por ano.
  const [grades, setGrades] = useState<Record<string, Grades>>(() => read(gradesKey(year)) ?? {});
  const [filter, setFilter] = useState<Filter>("todas");
  const [query, setQuery] = useState("");
  const [formulasRef, formulasIn] = useInView<HTMLDetailsElement>();

  useEffect(() => write(gradesKey(year), grades), [year, grades]);

  const update = (name: string, patch: Partial<Grades>) =>
    setGrades((g) => ({ ...g, [name]: { ...EMPTY, ...g[name], ...patch } }));

  const rows = useMemo(
    () =>
      subjects.map((name) => {
        const g = grades[name] ?? EMPTY;
        const r = calculateFromNotes({
          s1n1: toGrade(g.s1n1),
          s1n2: toGrade(g.s1n2),
          s2n1: toGrade(g.s2n1),
          s2n2: toGrade(g.s2n2),
          rec: toGrade(g.rec),
        });
        return { name, g, r };
      }),
    [subjects, grades],
  );
  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    ({ name, r }) => (filter === "todas" || r.situation === filter) && (!q || name.toLowerCase().includes(q)),
  );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 animate-slide-down bg-brand text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <GraduationCap aria-hidden size={28} /> <span className="hidden min-[400px]:inline">Aprovaê</span>
          </div>
          <nav className="flex items-center text-sm">
            <span className="flex items-center gap-2 border-b-2 border-white pb-1 font-medium">
              <LayoutGrid size={18} aria-hidden /> Disciplinas
            </span>
          </nav>
          <button
            onClick={onChangeYear}
            className="flex h-11 cursor-pointer items-center gap-2 rounded-full bg-white/10 pr-3 pl-1.5 text-sm outline-none transition-[background-color,transform] hover:bg-white/20 active:scale-95 focus-visible:ring-2 focus-visible:ring-white"
            aria-label={`${year}º ano Tech. Trocar de ano`}
          >
            <span className="grid size-8 place-items-center rounded-full bg-white text-sm font-bold text-brand">{year}º</span>
            <span className="hidden sm:inline">Tech</span>
            <ChevronDown size={16} aria-hidden />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:py-8">
        <div className="animate-fade-up">
          <h1 className="text-xl font-semibold sm:text-2xl">Disciplinas do {year}º ano</h1>
          <p className="text-sm text-muted">Digite a N1 e a N2 de cada semestre. Tudo fica salvo neste navegador.</p>
        </div>

        <Summary results={rows.map((x) => x.r)} />

        <div
          className="flex animate-fade-up flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ animationDelay: "120ms" }}
        >
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtrar por situação">
            {FILTERS.map((f) => {
              const active = filter === f;
              const n = f === "todas" ? rows.length : rows.filter((x) => x.r.situation === f).length;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={active}
                  className={`h-9 shrink-0 cursor-pointer rounded-full px-3.5 text-xs font-medium outline-none transition-[background-color,color,transform] duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand ${
                    active ? "bg-brand text-white shadow-lift" : "bg-white text-ink shadow-card hover:bg-brand-soft"
                  }`}
                >
                  {f === "todas" ? "Todas" : SITUATION[f].text}{" "}
                  <span key={n} className="inline-block animate-pop opacity-70 tabular-nums">
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="relative sm:w-64">
            <span className="sr-only">Buscar disciplina</span>
            <Search size={16} aria-hidden className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar disciplina"
              className="h-11 w-full rounded-lg border border-line bg-white pr-3 pl-9 text-sm outline-none transition-shadow focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
          </label>
        </div>

        <section className="lg:overflow-hidden lg:rounded-2xl lg:bg-white lg:shadow-card">
          <div className={`hidden border-b border-line px-4 py-3 pl-5 text-xs font-semibold lg:grid ${GRID}`}>
            <span>Disciplinas</span>
            <span>
              1º Semestre <span className="block font-normal text-muted">N1 · N2 · Média</span>
            </span>
            <span>
              2º Semestre <span className="block font-normal text-muted">N1 · N2 · Média</span>
            </span>
            <span>Média Anual</span>
            <span>Rec. Final</span>
            <span>Média Final</span>
            <span>Situação</span>
          </div>

          {/* A key muda com o filtro para a lista entrar de novo em cascata. */}
          <ul key={filter + q} className="space-y-3 lg:space-y-0 lg:divide-y lg:divide-line">
            {visible.map(({ name, g, r }, i) => (
              <SubjectRow key={name} name={name} grades={g} result={r} index={i} onChange={(p) => update(name, p)} />
            ))}
          </ul>

          {visible.length === 0 && (
            <p className="animate-fade-up rounded-xl bg-white p-8 text-center text-sm text-muted shadow-card lg:rounded-none lg:shadow-none">
              Nenhuma disciplina com esse filtro.
            </p>
          )}
        </section>

        <details
          ref={formulasRef}
          className={`reveal group rounded-2xl bg-white shadow-card [&_summary::-webkit-details-marker]:hidden ${formulasIn ? "in" : ""}`}
          open
        >
          <summary className="flex h-14 cursor-pointer list-none items-center justify-between rounded-2xl px-5 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand">
            Como as médias são calculadas
            <ChevronDown size={20} aria-hidden className="text-muted transition-transform duration-300 group-open:rotate-180" />
          </summary>
          <div className="px-3 pb-4 sm:px-5 sm:pb-5">
            <Formulas />
          </div>
        </details>
      </main>
    </div>
  );
}
