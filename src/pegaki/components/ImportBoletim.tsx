import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, FileUp, Loader2, RotateCcw, X } from "lucide-react";
import { BoletimError, matchSubjects, type BoletimMatch } from "../lib/boletim";
import { fmt } from "../lib/grades";

const UNDO_MS = 8000;

interface Props {
  year: number;
  subjects: string[];
  /** Lança as notas do boletim e devolve a função que desfaz. */
  onImport: (matched: BoletimMatch["matched"]) => () => void;
}

type Dialog = { kind: "preview"; match: BoletimMatch } | { kind: "error"; message: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Importar boletim": lê o PDF do boletim da escola, mostra o que achou e lança as notas. */
export function ImportBoletim({ year, subjects, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [undo, setUndo] = useState<{ fn: () => void; n: number } | null>(null);

  useEffect(() => {
    if (dialog) confirmRef.current?.focus();
  }, [dialog]);

  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(t);
  }, [undo]);

  const read = async (file: File) => {
    setBusy(true);
    try {
      const { readBoletimPdf } = await import("../lib/readBoletimPdf");
      const b = await readBoletimPdf(file);
      if (b.year !== null && b.year !== year) {
        setDialog({ kind: "error", message: `Este boletim é do ${b.year}º ano. Troque para o ${b.year}º ano antes de importar.` });
        return;
      }
      const match = matchSubjects(b.rows, subjects);
      const withGrades = match.matched.filter(({ row }) => row.s1 !== null || row.s2 !== null || row.rf !== null);
      if (withGrades.length === 0) {
        setDialog({
          kind: "error",
          message: match.matched.length
            ? "O boletim ainda não tem nenhuma nota lançada."
            : `Nenhuma disciplina do boletim bate com as do ${year}º ano.`,
        });
        return;
      }
      setDialog({ kind: "preview", match: { ...match, matched: withGrades } });
    } catch (e) {
      setDialog({ kind: "error", message: e instanceof BoletimError ? e.message : "Não foi possível ler o boletim. Tente de novo." });
    } finally {
      setBusy(false);
    }
  };

  const confirm = (match: BoletimMatch) => {
    const restore = onImport(match.matched);
    setDialog(null);
    setUndo({ fn: restore, n: match.matched.length });
  };

  const close = () => setDialog(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // deixa escolher o mesmo arquivo de novo
          if (file) void read(file);
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-busy={busy}
        title="Lançar as notas a partir do PDF do boletim da escola"
        className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-medium text-ink outline-none transition-[border-color,background-color,transform] duration-200 hover:border-brand/40 hover:bg-brand-soft active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-wait disabled:opacity-70"
      >
        {busy ? <Loader2 size={16} aria-hidden className="animate-spin" /> : <FileUp size={16} aria-hidden />}
        <span className="sm:hidden">{busy ? "Lendo..." : "Importar"}</span>
        <span className="hidden sm:inline">{busy ? "Lendo boletim..." : "Importar boletim"}</span>
      </button>

      {dialog &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            aria-describedby="import-desc"
            className="fixed inset-0 z-40 grid animate-fade-up place-items-center bg-black/40 p-4"
            onClick={(e) => e.target === e.currentTarget && close()}
            onKeyDown={(e) => e.key === "Escape" && close()}
          >
            <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col rounded-2xl bg-surface p-5 shadow-lift">
              {dialog.kind === "error" ? (
                <>
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-chip-red text-chip-red-ink">
                      <AlertTriangle size={20} aria-hidden />
                    </span>
                    <div>
                      <h2 id="import-title" className="font-semibold">
                        Não deu para importar
                      </h2>
                      <p id="import-desc" className="mt-1 text-sm text-muted">
                        {dialog.message}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      onClick={close}
                      className="h-11 cursor-pointer rounded-lg border border-line bg-surface text-sm font-medium text-ink outline-none transition-colors hover:bg-page focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      Fechar
                    </button>
                    <button
                      ref={confirmRef}
                      onClick={() => {
                        close();
                        inputRef.current?.click();
                      }}
                      className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand text-sm font-medium text-white outline-none transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                      <FileUp size={16} aria-hidden /> Outro arquivo
                    </button>
                  </div>
                </>
              ) : (
                <Preview year={year} match={dialog.match} confirmRef={confirmRef} onCancel={close} onConfirm={() => confirm(dialog.match)} />
              )}
            </div>
          </div>,
          document.body,
        )}

      {undo &&
        createPortal(
          <div
            role="status"
            className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md animate-fade-up items-center gap-3 rounded-xl bg-ink py-2 pr-2 pl-4 text-sm text-page shadow-lift"
          >
            <span className="flex-1">Notas de {plural(undo.n, "disciplina importadas", "disciplinas importadas")}.</span>
            <button
              onClick={() => {
                undo.fn();
                setUndo(null);
              }}
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 font-semibold text-page outline-none transition-colors hover:bg-page/15 focus-visible:ring-2 focus-visible:ring-page"
            >
              <RotateCcw size={15} aria-hidden /> Desfazer
            </button>
            <button
              onClick={() => setUndo(null)}
              aria-label="Fechar aviso"
              className="grid size-9 cursor-pointer place-items-center rounded-lg text-page/70 outline-none transition-colors hover:bg-page/15 hover:text-page focus-visible:ring-2 focus-visible:ring-page"
            >
              <X size={16} aria-hidden />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

function Preview({
  year,
  match,
  confirmRef,
  onCancel,
  onConfirm,
}: {
  year: number;
  match: BoletimMatch;
  confirmRef: RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const rows = match.matched;
  const has = (k: "s1" | "s2" | "rf") => rows.some(({ row }) => row[k] !== null);
  const cols = [
    { k: "s1" as const, label: "1º sem." },
    { k: "s2" as const, label: "2º sem." },
    { k: "rf" as const, label: "Rec." },
  ].filter((c) => has(c.k));
  const sems = [has("s1") && "1º", has("s2") && "2º"].filter(Boolean).join(" e do ");

  return (
    <>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink">
          <FileUp size={20} aria-hidden />
        </span>
        <div>
          <h2 id="import-title" className="font-semibold">
            Importar o boletim do {year}º ano?
          </h2>
          <p id="import-desc" className="mt-1 text-sm text-muted">
            Encontramos notas de {plural(rows.length, "disciplina", "disciplinas")}.
            {sems && ` As médias do ${sems} semestre passam a ser lançadas como "Média" e substituem as que já estavam lá.`}
          </p>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface text-xs text-muted">
            <tr className="border-b border-line">
              <th className="px-3 py-2 text-left font-medium">Disciplina</th>
              {cols.map((c) => (
                <th key={c.k} className="px-2 py-2 text-right font-medium whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ subject, row }) => (
              <tr key={subject}>
                <td className="px-3 py-1.5 leading-snug">{subject}</td>
                {cols.map((c) => (
                  <td key={c.k} className="px-2 py-1.5 text-right font-medium tabular-nums">
                    {fmt(row[c.k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {match.unknown.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          <span className="font-medium text-ink">Ficaram de fora</span> (não estão na lista do {year}º ano): {match.unknown.join(", ")}.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          onClick={onCancel}
          className="h-11 cursor-pointer rounded-lg border border-line bg-surface text-sm font-medium text-ink outline-none transition-colors hover:bg-page focus-visible:ring-2 focus-visible:ring-brand"
        >
          Cancelar
        </button>
        <button
          ref={confirmRef}
          onClick={onConfirm}
          className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand text-sm font-medium text-white outline-none transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <FileUp size={16} aria-hidden /> Importar notas
        </button>
      </div>
    </>
  );
}
