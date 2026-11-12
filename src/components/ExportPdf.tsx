import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileDown, GraduationCap, X } from "lucide-react";
import type { NotesResult } from "../lib/grades";
import formulas from "../assets/boletim-formulas.png";
import { SITUATION } from "./SubjectRow";
import { CLASSROOMS_BY_YEAR, type Year } from "../data/subjects";
import { Segmented } from "./Segmented";

const STUDENT_KEY = "aprovae:student";

interface Student {
  name: string;
  /** Sala (D, E, F...) e número de chamada, nos anos com lista de salas. */
  sala: string;
  numero: string;
  /** Turma em texto livre, nos anos sem lista de salas. */
  turma: string;
}

/** Texto da turma como sai no boletim, ex.: "2ª Tec D - Nº 3". */
export function turmaText(year: Year, s: Student): string {
  if (!CLASSROOMS_BY_YEAR[year]) return s.turma;
  return `${year}ª Tec${s.sala ? ` ${s.sala}` : ""}${s.numero ? ` - Nº ${s.numero}` : ""}`;
}

export interface ReportRow {
  name: string;
  r: NotesResult;
  /** Nota da recuperação final digitada. */
  rec: number | null;
}

function readStudent(year: Year): Student {
  const empty: Student = { name: "", sala: "", numero: "", turma: `${year}ª Tec` };
  try {
    const saved = JSON.parse(localStorage.getItem(STUDENT_KEY) ?? "null") as Partial<Student> | null;
    if (!saved) return empty;
    // Versão anterior guardava só o texto da turma ("2ª Tec D - Nº 3"): tira a sala e o número dele.
    const old = /Tec\s+([A-Z])\b(?:\s*-\s*Nº\s*(\d+))?/.exec(saved.turma ?? "");
    const rooms = CLASSROOMS_BY_YEAR[year] ?? [];
    const sala = saved.sala ?? (old && rooms.includes(old[1]) ? old[1] : "");
    return { name: saved.name ?? "", sala: rooms.includes(sala) ? sala : "", numero: saved.numero ?? old?.[2] ?? "", turma: saved.turma ?? empty.turma };
  } catch {
    return empty;
  }
}

/*
 * Boletim para imprimir/salvar em PDF, copiando o layout do boletim da escola, que é gerado pelo
 * Chrome (Puppeteer, page.pdf). Aqui o PDF sai do mesmo motor, pelo "Salvar como PDF" do navegador.
 * As medidas são em px CSS, as mesmas do PDF original (A4 = 794 × 1123 px).
 */
const FONT = 'Arial, "Liberation Sans", Helvetica, sans-serif';
const RED = "#ff0000";
// Larguras das colunas, tiradas das linhas da tabela do PDF original.
const COLS = [325, 52, 50, 51, 50, 33, 29, 31, 64, 67];
const HEAD = ["Disciplinas", "1ºSem", "Faltas", "2ºSem", "Faltas", "MA", "RF", "MF", "% Freq", "Situação"];

const num = (n: number | null) => (n === null ? "-" : n.toFixed(2));

function cell(n: number | null, min: number) {
  return <span style={n !== null && n < min ? { color: RED } : undefined}>{num(n)}</span>;
}

function Report({ rows, student, issued }: { rows: ReportRow[]; student: { name: string; turma: string }; issued: string }) {
  const td = { border: "1px solid #000", padding: "0 4px", height: 20, textAlign: "center" as const, whiteSpace: "nowrap" as const };
  const info = { padding: "0 4px", whiteSpace: "nowrap" as const, verticalAlign: "middle" as const };
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <div
      className="boletim-print"
      style={{
        width: 795,
        boxSizing: "border-box",
        border: "1px solid #ccc",
        padding: "20px 20px 24px",
        fontFamily: FONT,
        fontSize: 10,
        color: "#000",
        background: "#fff",
      }}
    >
      <div style={{ position: "relative", height: 107 }}>
        {/* Marca do Pegaki no lugar do logo da escola: este boletim não é o documento oficial. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 10,
            width: 120,
            height: 68,
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "#0a2dc4",
          }}
        >
          <GraduationCap size={34} strokeWidth={2} aria-hidden />
          <span style={{ fontFamily: '"Poppins", system-ui, sans-serif', fontSize: 18, fontWeight: 600 }}>Pegaki</span>
        </div>
        <div style={{ position: "absolute", left: 257, top: 23, fontSize: 20, lineHeight: "20px", fontWeight: "bold" }}>
          Boletim Escolar
        </div>
      </div>

      <table
        style={{
          width: 753,
          borderCollapse: "separate",
          borderSpacing: 0,
          border: "1px solid #ccc",
          background: "#fff",
          tableLayout: "fixed",
        }}
      >
        <colgroup>
          <col style={{ width: 478 }} />
          <col style={{ width: 273 }} />
        </colgroup>
        <tbody>
          <tr style={{ height: 22 }}>
            {/* 1px a menos embaixo: no original o nome fica 1px acima do "ANO LETIVO". */}
            <td style={{ ...info, paddingBottom: 1 }}>ALUNO(A): {student.name}</td>
            <td style={{ ...info, textAlign: "right", fontSize: 12 }}>ANO LETIVO: {new Date().getFullYear()}</td>
          </tr>
          <tr style={{ height: 19 }}>
            <td style={{ ...info, textAlign: "right" }}>TURMA: {student.turma}</td>
            <td />
          </tr>
          <tr style={{ height: 19 }}>
            <td style={info}>UNIDADE: Gerado pelo Pegaki (não substitui o boletim oficial)</td>
            <td style={{ ...info, textAlign: "right", fontSize: 9 }}>EMISSÃO: {issued}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: 753, marginTop: 10, borderCollapse: "collapse", tableLayout: "fixed", background: "#fff" }}>
        <colgroup>
          {COLS.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {HEAD.map((h, i) => (
              <th key={i} style={{ ...td, fontWeight: "bold", textAlign: i === 0 ? "left" : "center" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ name, r, rec }) => {
            const closed = r.situation !== "andamento" && r.situation !== "sem-notas";
            return (
              <tr key={name}>
                <td style={{ ...td, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</td>
                <td style={td}>{cell(r.m1, 7)}</td>
                <td style={td}>-</td>
                <td style={td}>{cell(r.m2, 7)}</td>
                <td style={td}>-</td>
                <td style={td}>{closed ? cell(r.annual, 7) : "-"}</td>
                <td style={td}>{r.final !== null ? num(rec) : "-"}</td>
                <td style={td}>{cell(r.final, 6)}</td>
                <td style={td}>-</td>
                <td style={{ ...td, overflow: "hidden", textOverflow: "ellipsis" }}>{closed ? SITUATION[r.situation].text : "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 5, paddingLeft: 10, lineHeight: "21px" }}>
        <div>MA - Média Anual</div>
        <div>RF - Recuperação Final</div>
        <div>MF - Média Final</div>
        <div>% Freq - Percentual de frequência do aluno na disciplina, no período com nota lançada</div>
      </div>

      <img src={formulas} alt="" width={753} height={90} style={{ display: "block", width: 753, height: 90, marginTop: 35 }} />
    </div>
  );
}

/** Botão "Exportar PDF": pede nome e turma, e abre a impressão já com o boletim montado. */
export function ExportPdf({ year, rows }: { year: Year; rows: ReportRow[] }) {
  const [open, setOpen] = useState(false);
  // Cada clique em "Gerar PDF" é um pedido novo; o boletim fica montado (escondido na tela) depois do primeiro.
  const [job, setJob] = useState(0);
  const [student, setStudent] = useState<Student>(() => readStudent(year));
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) nameRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (job === 0) return;
    // O título vira o título do PDF e o nome sugerido do arquivo, como no original.
    const prev = document.title;
    document.title = "Boletim Escolar";
    const restore = () => {
      document.title = prev;
    };
    // Nem todo navegador avisa o fim da impressão (Safari no iPhone); aí o título volta no próximo pedido.
    window.addEventListener("afterprint", restore, { once: true });
    // Espera a imagem das fórmulas carregar antes de abrir a impressão (com um limite, se ela não avisar).
    let printed = false;
    const print = () => {
      if (printed) return;
      printed = true;
      window.print();
    };
    const img = new Image();
    img.onload = img.onerror = print;
    img.src = formulas;
    if (img.complete) print();
    const fallback = window.setTimeout(print, 1500);
    return () => {
      window.clearTimeout(fallback);
      window.removeEventListener("afterprint", restore);
      restore();
    };
  }, [job]);

  const exportPdf = () => {
    try {
      localStorage.setItem(STUDENT_KEY, JSON.stringify(student));
    } catch {
      /* sem armazenamento */
    }
    setOpen(false);
    setJob((n) => n + 1);
  };

  const issued = new Date().toLocaleDateString("pt-BR");
  const rooms = CLASSROOMS_BY_YEAR[year];
  const field =
    "h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none transition-shadow focus:border-brand focus:ring-4 focus:ring-brand/15";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group/export inline-flex h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface pr-4 pl-1.5 text-sm font-medium text-ink outline-none transition-[border-color,background-color,box-shadow,transform] duration-200 hover:border-brand/30 hover:bg-brand-soft/40 hover:shadow-card active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-brand text-white transition-transform duration-200 group-hover/export:-translate-y-0.5">
          <FileDown size={16} aria-hidden />
        </span>
        <span className="flex flex-col items-start leading-tight whitespace-nowrap">
          Exportar boletim
          <span className="text-[11px] font-normal text-muted">PDF · A4</span>
        </span>
      </button>

      {/* No body: dentro da página, a animação do bloco prenderia o diálogo atrás dos cards. */}
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
            className="fixed inset-0 z-40 grid animate-fade-up place-items-center bg-black/40 p-4"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                exportPdf();
              }}
              className="w-full max-w-sm space-y-4 rounded-2xl bg-surface p-5 shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="export-title" className="font-semibold">
                    Exportar boletim
                  </h2>
                  <p className="text-sm text-muted">Na janela de impressão, escolha "Salvar como PDF".</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar"
                  className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-muted outline-none hover:bg-ink/5 focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Nome do aluno</span>
                <input
                  ref={nameRef}
                  className={field}
                  value={student.name}
                  onChange={(e) => setStudent((s) => ({ ...s, name: e.target.value }))}
                />
              </label>
              {rooms ? (
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <fieldset className="min-w-0">
                    <legend className="mb-1 text-xs font-medium text-muted">Sala</legend>
                    <Segmented
                      ariaLabel="Sala"
                      options={rooms.map((r) => ({ value: r, label: r, ariaLabel: `Sala ${r}` }))}
                      value={student.sala}
                      onChange={(r) => setStudent((s) => ({ ...s, sala: s.sala === r ? "" : r }))}
                      className="gap-1 rounded-xl bg-page p-1"
                      indicatorClassName="rounded-lg bg-brand shadow-lift"
                      buttonClassName="h-9 flex-1 rounded-lg text-sm font-semibold"
                    />
                  </fieldset>
                  <label className="w-20">
                    <span className="mb-1 block text-xs font-medium text-muted">Nº</span>
                    <input
                      className={`${field} text-center`}
                      inputMode="numeric"
                      placeholder="-"
                      value={student.numero}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                        setStudent((s) => ({ ...s, numero: v }));
                      }}
                    />
                  </label>
                  <p className="col-span-2 -mt-1 text-xs text-muted">
                    No boletim: <span className="font-medium text-ink">{turmaText(year, student)}</span>
                  </p>
                </div>
              ) : (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Turma</span>
                  <input
                    className={field}
                    value={student.turma}
                    placeholder={`${year}ª Tec D - Nº 3`}
                    onChange={(e) => setStudent((s) => ({ ...s, turma: e.target.value }))}
                  />
                </label>
              )}
              <button
                type="submit"
                className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand text-sm font-medium text-white outline-none transition-[background-color,transform] hover:bg-brand-dark active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                <FileDown size={16} aria-hidden /> Gerar PDF
              </button>
            </form>
          </div>,
          document.body,
        )}

      {job > 0 && createPortal(<Report rows={rows} student={{ name: student.name, turma: turmaText(year, student) }} issued={issued} />, document.body)}
    </>
  );
}
