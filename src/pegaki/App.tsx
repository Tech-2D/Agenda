import { agendaMenuUrl } from "../menuShortcuts";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import { useNotebook } from "./lib/useNotebook";
import { ChevronDown, Search } from "lucide-react";
import { calculateSemesters, DEFAULT_N1_WEIGHT, type InputMode, type Modes, type Situation } from "./lib/grades";
import { SUBJECTS_BY_YEAR, type Year } from "./data/subjects";
import { Formulas } from "./components/Formulas";
import { YearPicker } from "./components/YearPicker";
import { Summary } from "./components/Summary";
import { GRID, SITUATION, SubjectRow, toGrade, type Grades } from "./components/SubjectRow";
import { SubjectDetail } from "./components/SubjectDetail";
import { ExportPdf } from "./components/ExportPdf";
import { Segmented } from "./components/Segmented";
import { AppHeader } from "./components/AppHeader";
import { ClearGrades } from "./components/ClearGrades";
import { ImportBoletim } from "./components/ImportBoletim";
import type { BoletimMatch } from "./lib/boletim";

const YEAR_KEY = "aprovae:year";
const CLOUD_GRADES_ENABLED = import.meta.env.VITE_PEGAKI_CLOUD_GRADES === 'true';
const EMPTY: Grades = {
  s1n1: "",
  s1n2: "",
  s2n1: "",
  s2n2: "",
  s1avg: "",
  s2avg: "",
  rec: "",
  s1Weight: DEFAULT_N1_WEIGHT,
  s2Weight: DEFAULT_N1_WEIGHT,
};

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

const MODES: { value: InputMode; label: string }[] = [
  { value: "notas", label: "N1 e N2" },
  { value: "media", label: "Média" },
];


const modeHint = (m: InputMode) => (m === "media" ? "Média" : "N1 · N2 · Média");
const swapIn = (m: InputMode) => (m === "media" ? "animate-swap-in-right" : "animate-swap-in-left");

// Campos que são nota (o resto, como os pesos, é configuração).
const GRADE_FIELDS = ["s1n1", "s1n2", "s2n1", "s2n2", "s1avg", "s2avg", "rec"] as const;

const hasSubjects = (y: Year | null): y is Year => y !== null && SUBJECTS_BY_YEAR[y]?.length > 0;

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(CLOUD_GRADES_ENABLED ? undefined : null);
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  useEffect(() => { if (CLOUD_GRADES_ENABLED) return onAuthStateChanged(auth, setUser); }, []);
  const [year, setYear] = useState<Year | null>(() => {
    const saved = read<Year>(YEAR_KEY);
    return hasSubjects(saved) ? saved : null;
  });

  const pick = (y: Year | null) => {
    write(YEAR_KEY, y);
    setYear(y);
    window.scrollTo({ top: 0 });
  };

  if (user === undefined) return <p role="status" className="p-6 text-muted">Carregando sua conta…</p>;
  if (!hasSubjects(year)) return <YearPicker onPick={pick} />;
  return <GradesView key={`${user?.uid ?? "guest"}:${year}:${academicYear}`} user={user} academicYear={academicYear} onAcademicYear={setAcademicYear} year={year} onChangeYear={() => pick(null)} />;
}

function GradesView({ year, onChangeYear, user, academicYear, onAcademicYear }: { year: Year; onChangeYear: () => void; user: User | null; academicYear: number; onAcademicYear: (year: number) => void }) {
  const subjects = SUBJECTS_BY_YEAR[year];
  // As notas ficam salvas pelo nome da disciplina; a lista em si é fixa por ano.
  const cloud = useNotebook(user, year, academicYear);
  const { grades, setGrades, modes, setModes } = cloud;
  const [filter, setFilter] = useState<Filter>("todas");
  const [query, setQuery] = useState("");
  // Modo de cada semestre, para todas as disciplinas; as notas de cada modo ficam guardadas separadas.
  // Só anima o cabeçalho da tabela depois que o modo foi trocado (não ao abrir a página).
  const [modeTouched, setModeTouched] = useState(false);


  // Disciplina aberta na tela de detalhe. Entra no histórico para o "voltar" do celular fechar a tela.
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const onPop = () => setOpen(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const openSubject = (name: string) => {
    history.pushState({ subject: name }, "");
    setOpen(name);
  };
  const closeSubject = () => history.back();

  const update = (name: string, patch: Partial<Grades>) => setGrades((g) => ({ ...g, [name]: { ...EMPTY, ...g[name], ...patch } }));

  // Apaga as notas do ano (mantém os pesos, que são configuração) e devolve como desfazer.
  const clearGrades = () => {
    const before = grades;
    setGrades((g) =>
      Object.fromEntries(
        Object.entries(g).map(([k, v]) => [
          k,
          { ...EMPTY, s1Weight: v.s1Weight ?? DEFAULT_N1_WEIGHT, s2Weight: v.s2Weight ?? DEFAULT_N1_WEIGHT },
        ]),
      ),
    );
    return () => setGrades(before);
  };

  // Lança as médias e a recuperação do boletim importado. Os semestres que vieram com nota passam
  // para o modo "Média" (as N1/N2 já digitadas continuam guardadas). Devolve como desfazer.
  const importGrades = (matched: BoletimMatch["matched"]) => {
    const before = { grades, modes };
    const text = (n: number) => n.toFixed(2).replace(".", ",");
    setGrades((g) => {
      const next = { ...g };
      for (const { subject, row } of matched) {
        const patch: Partial<Grades> = {};
        if (row.s1 !== null) patch.s1avg = text(row.s1);
        if (row.s2 !== null) patch.s2avg = text(row.s2);
        if (row.rf !== null) patch.rec = text(row.rf);
        next[subject] = { ...EMPTY, ...g[subject], ...patch };
      }
      return next;
    });
    const has = (k: "s1" | "s2") => matched.some(({ row }) => row[k] !== null);
    const nextModes: Modes = { s1: has("s1") ? "media" : modes.s1, s2: has("s2") ? "media" : modes.s2 };
    if (nextModes.s1 !== modes.s1 || nextModes.s2 !== modes.s2) setModeTouched(true);
    setModes(nextModes);
    return () => {
      setGrades(before.grades);
      setModes(before.modes);
    };
  };

  const rows = useMemo(
    () =>
      subjects.map((name) => {
        // Notas salvas antes do modo "media" e dos pesos não têm s1avg/s2avg nem os pesos.
        const g = { ...EMPTY, ...grades[name] };
        const r = calculateSemesters(
          { mode: modes.s1, n1: toGrade(g.s1n1), n2: toGrade(g.s1n2), avg: toGrade(g.s1avg), weight: g.s1Weight },
          { mode: modes.s2, n1: toGrade(g.s2n1), n2: toGrade(g.s2n2), avg: toGrade(g.s2avg), weight: g.s2Weight },
          toGrade(g.rec),
        );
        return { name, g, r };
      }),
    [subjects, grades, modes],
  );
  const detail = rows.find((x) => x.name === open);
  const q = query.trim().toLowerCase();
  const visible = rows.filter(({ name, r }) => (filter === "todas" || r.situation === filter) && (!q || name.toLowerCase().includes(q)));

  if (user && !cloud.ready) return <main className="mx-auto max-w-7xl p-6"><p role="status">{cloud.loading ? 'Carregando notas da sua conta…' : cloud.error}</p>{!cloud.loading && <button type="button" onClick={cloud.reload}>Tentar novamente</button>}</main>;

  return (
    <div className="min-h-dvh">
      <AppHeader year={year} onChangeYear={() => { void cloud.save().then(saved => { if (!cloud.dirty || saved) onChangeYear(); }); }} />

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:py-8">
        <section aria-label="Notas da sua conta" className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-4 shadow-card">
          {user ? <>
            <label className="inline-flex items-center gap-2 text-sm">
              Ano letivo
              <span className="relative inline-flex">
                <select aria-label="Ano letivo" className="appearance-none rounded-lg border border-line bg-surface py-2 pr-9 pl-3"
                  disabled={cloud.loading || cloud.saving} value={academicYear}
                  onChange={event => {
                    const next = Number(event.target.value);
                    void cloud.save().then(saved => { if (!cloud.dirty || saved) onAcademicYear(next); });
                  }}>
                  {Array.from({ length: 7 }, (_, index) => new Date().getFullYear() + 1 - index).map(value => <option key={value}>{value}</option>)}
                </select>
                <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" />
              </span>
            </label>
            <span className="text-sm text-muted" role="status">{cloud.loading ? 'Carregando notas…' : cloud.saving ? 'Salvando…' : cloud.error ? 'Salvamento pendente' : cloud.dirty ? 'Aguardando para salvar…' : 'Notas salvas na conta'}</span>
            {cloud.canImport && <button type="button" className="text-sm text-brand-ink underline" onClick={cloud.importLocal}>Importar notas deste navegador</button>}
            {cloud.error && <p role="alert" className="w-full text-sm">{cloud.error}</p>}
            {cloud.conflict && <button type="button" onClick={()=>{if(window.confirm('Recarregar as notas da conta e descartar as alterações desta tela?'))cloud.reload()}}>Recarregar notas da conta</button>}
          </> : <><p className="flex-1 text-sm text-muted">{CLOUD_GRADES_ENABLED ? 'Suas notas ficam neste navegador. Entre para salvá-las na conta e acessar em outros dispositivos.' : 'Suas notas ficam salvas neste navegador.'}</p>{CLOUD_GRADES_ENABLED && <a className="text-sm text-brand-ink underline" href={agendaMenuUrl("profiles")}>Entrar ou criar conta</a>}</>}
        </section>
        <div className="flex animate-fade-up flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Disciplinas do {year}º ano</h1>
            <p className="text-sm text-muted">
              <span className="sm:hidden">Notas privadas, com cálculo atualizado enquanto você digita.</span>
              <span className="hidden sm:inline">
                Escolha, em cada semestre, se vai lançar a N1 e a N2 ou só a média. Notas privadas, com cálculo atualizado enquanto você digita.
              </span>
            </p>
          </div>
          {/* No celular os dois seletores viram um painel com título; no desktop ficam soltos ao lado do título. */}
          <section
            aria-label="Como lançar as notas"
            className="shrink-0 rounded-2xl bg-surface p-3 shadow-card sm:bg-transparent sm:p-0 sm:shadow-none"
          >
            <h2 className="mb-2 px-1 text-xs font-semibold text-muted sm:hidden">Como lançar as notas</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["s1", "s2"] as const).map((sem, i) => (
                <div key={sem} className="flex min-w-0 items-center justify-between gap-3 sm:block">
                  <span className="px-1 text-sm font-medium text-ink sm:mb-1 sm:block sm:text-[11px] sm:font-semibold sm:text-muted">
                    {i + 1}º semestre
                  </span>
                  <Segmented
                    ariaLabel={`Como lançar as notas do ${i + 1}º semestre`}
                    options={MODES}
                    value={modes[sem]}
                    onChange={(v) => {
                      setModeTouched(true);
                      setModes((x) => ({ ...x, [sem]: v }));
                    }}
                    className="w-44 shrink-0 rounded-full bg-page p-1 sm:w-auto sm:bg-surface sm:shadow-card"
                    buttonClassName="h-9 flex-1 rounded-full px-3 text-xs font-medium sm:flex-none"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        <Summary
          rows={rows}
          action={
            <>
              <ClearGrades
                year={year}
                filled={rows.filter(({ g }) => GRADE_FIELDS.some((f) => g[f] !== "")).length}
                onClear={clearGrades}
              />
              <ImportBoletim year={year} subjects={subjects} onImport={importGrades} />
              <ExportPdf year={year} rows={rows.map(({ name, g, r }) => ({ name, r, rec: toGrade(g.rec) }))} />
            </>
          }
        />

        <div
          className="flex animate-fade-up flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ animationDelay: "120ms" }}
        >
          <div
            className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
            role="group"
            aria-label="Filtrar por situação"
          >
            {FILTERS.map((f) => {
              const active = filter === f;
              const n = f === "todas" ? rows.length : rows.filter((x) => x.r.situation === f).length;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={active}
                  className={`h-9 shrink-0 cursor-pointer rounded-full px-3.5 text-xs font-medium outline-none transition-[background-color,color,transform] duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand ${
                    active ? "bg-brand text-white shadow-lift" : "bg-surface text-ink shadow-card hover:bg-brand-soft"
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
              className="h-11 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm outline-none transition-shadow focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
          </label>
        </div>

        <section className="lg:overflow-hidden lg:rounded-2xl lg:bg-surface lg:shadow-card">
          <div className={`hidden border-b border-line px-4 py-3 pl-5 text-xs font-semibold lg:grid ${GRID}`}>
            <span>Disciplinas</span>
            <span>
              1º Semestre{" "}
              <span key={modes.s1} className={`block font-normal text-muted ${modeTouched ? swapIn(modes.s1) : ""}`}>
                {modeHint(modes.s1)}
              </span>
            </span>
            <span>
              2º Semestre{" "}
              <span key={modes.s2} className={`block font-normal text-muted ${modeTouched ? swapIn(modes.s2) : ""}`}>
                {modeHint(modes.s2)}
              </span>
            </span>
            <span>Média Anual</span>
            <span>Rec. Final</span>
            <span>Média Final</span>
            <span>Situação</span>
          </div>

          {/* A key muda com o filtro para a lista entrar de novo em cascata. */}
          <ul key={filter + q} className="space-y-3 lg:space-y-0 lg:divide-y lg:divide-line">
            {visible.map(({ name, g, r }, i) => (
              <SubjectRow
                key={name}
                name={name}
                modes={modes}
                grades={g}
                result={r}
                index={i}
                onChange={(p) => update(name, p)}
                onOpen={() => openSubject(name)}
              />
            ))}
          </ul>

          {visible.length === 0 && (
            <p className="animate-fade-up rounded-xl bg-surface p-8 text-center text-sm text-muted shadow-card lg:rounded-none lg:shadow-none">
              Nenhuma disciplina com esse filtro.
            </p>
          )}
        </section>

        <details
          className="group rounded-2xl bg-surface shadow-card [&_summary::-webkit-details-marker]:hidden"
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

      {detail && (
        <SubjectDetail
          name={detail.name}
          modes={modes}
          grades={detail.g}
          result={detail.r}
          onChange={(p) => update(detail.name, p)}
          onClose={closeSubject}
        />
      )}
    </div>
  );
}
