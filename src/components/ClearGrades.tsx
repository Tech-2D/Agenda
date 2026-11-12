import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, Trash2, X } from "lucide-react";

const UNDO_MS = 8000;

interface Props {
  year: number;
  /** Quantas disciplinas têm alguma nota lançada; com zero o botão fica desativado. */
  filled: number;
  /** Apaga as notas e devolve a função que as restaura. */
  onClear: () => () => void;
}

/** "Limpar notas": confirma antes de apagar e deixa desfazer por alguns segundos. */
export function ClearGrades({ year, filled, onClear }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [undo, setUndo] = useState<(() => void) | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  // O aviso de "Desfazer" some sozinho depois de alguns segundos.
  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(t);
  }, [undo]);

  const clear = () => {
    const restore = onClear();
    setConfirming(false);
    setUndo(() => restore);
  };

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        disabled={filled === 0}
        title={filled === 0 ? "Nenhuma nota lançada" : undefined}
        className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-medium text-muted outline-none transition-[border-color,background-color,color,transform] duration-200 hover:border-chip-red-ink/30 hover:bg-chip-red/50 hover:text-chip-red-ink active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50"
      >
        <Trash2 size={16} aria-hidden />
        <span className="sm:hidden">Limpar</span>
        <span className="hidden sm:inline">Limpar notas</span>
      </button>

      {confirming &&
        createPortal(
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-title"
            aria-describedby="clear-desc"
            className="fixed inset-0 z-40 grid animate-fade-up place-items-center bg-black/40 p-4"
            onClick={(e) => e.target === e.currentTarget && setConfirming(false)}
            onKeyDown={(e) => e.key === "Escape" && setConfirming(false)}
          >
            <div className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-lift">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-chip-red text-chip-red-ink">
                  <Trash2 size={20} aria-hidden />
                </span>
                <div>
                  <h2 id="clear-title" className="font-semibold">
                    Limpar as notas do {year}º ano?
                  </h2>
                  <p id="clear-desc" className="mt-1 text-sm text-muted">
                    Apaga as notas de {filled} {filled === 1 ? "disciplina" : "disciplinas"}, inclusive a recuperação. Os pesos da N1 e da
                    N2 continuam como estão.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  ref={cancelRef}
                  onClick={() => setConfirming(false)}
                  className="h-11 cursor-pointer rounded-lg border border-line bg-surface text-sm font-medium text-ink outline-none transition-colors hover:bg-page focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Cancelar
                </button>
                <button
                  onClick={clear}
                  className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-chip-red-ink text-sm font-medium text-surface outline-none transition-[background-color,transform] hover:brightness-110 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-chip-red-ink focus-visible:ring-offset-2"
                >
                  <Trash2 size={16} aria-hidden /> Limpar notas
                </button>
              </div>
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
            <span className="flex-1">Notas apagadas.</span>
            <button
              onClick={() => {
                undo();
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
