import { agendaMenuUrl } from "../../menuShortcuts";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, ExternalLink, GraduationCap, LayoutGrid, Menu, Settings, X } from "lucide-react";

const REPORT_CARD_URL = "https://alunos.igerminare.org.br/aluno/minhas-notas/4";

/**
 * Cabeçalho do app. No desktop (md+): marca, navegação, tema e ano lado a lado.
 * No celular: marca e um botão sanduíche que abre um painel com navegação, ano e aparência.
 */
export function AppHeader({ year, onChangeYear }: { year: number; onChangeYear: () => void }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstItem = useRef<HTMLAnchorElement>(null);

  // Abre focando o primeiro item; fecha com Esc devolvendo o foco ao botão. Trava a rolagem do fundo.
  useEffect(() => {
    if (!open) return;
    firstItem.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Ao passar para o layout de desktop o painel não faz mais sentido.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-30 animate-slide-down bg-brand text-on-brand shadow-md dark:border-b dark:border-line dark:bg-surface dark:text-ink dark:shadow-none">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <GraduationCap aria-hidden size={28} /> Pegaki
        </div>

        {/* Desktop */}
        <nav aria-label="Principal" className="hidden items-center gap-6 text-sm md:flex">
          <span aria-current="page" className="flex items-center gap-2 border-b-2 border-white pb-1 font-medium">
            <LayoutGrid size={18} aria-hidden /> Disciplinas
          </span>
          <a
            href={REPORT_CARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 border-b-2 border-transparent pb-1 text-on-brand/80 outline-none transition-colors hover:border-white/50 hover:text-on-brand focus-visible:border-white focus-visible:text-on-brand dark:text-ink/80 dark:hover:text-ink dark:focus-visible:text-ink"
          >
            Boletim <ExternalLink size={14} aria-hidden />
            <span className="sr-only">(abre o boletim na Odette em nova aba)</span>
          </a>
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <a href={agendaMenuUrl("settings")} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm" aria-label="Configurações de aparência do site"><Settings size={18} aria-hidden />Aparência</a>
          <button
            onClick={onChangeYear}
            className="flex h-11 cursor-pointer items-center gap-2 rounded-full bg-white/10 pr-3 pl-1.5 text-sm outline-none transition-[background-color,transform] hover:bg-white/20 active:scale-95 focus-visible:ring-2 focus-visible:ring-white"
            aria-label={`${year}º ano Tech. Trocar de ano`}
          >
            <span className="grid size-8 place-items-center rounded-full bg-white text-sm font-bold text-brand-ink dark:bg-brand dark:text-on-brand">
              {year}º
            </span>
            Tech
            <ChevronDown size={16} aria-hidden />
          </button>
        </div>

        {/* Celular: o ícone vira um X com o painel aberto. */}
        <button
          ref={toggleRef}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          className="relative grid size-11 cursor-pointer place-items-center rounded-full outline-none transition-[background-color,transform] hover:bg-white/15 active:scale-90 focus-visible:ring-2 focus-visible:ring-white md:hidden"
        >
          <Menu
            size={24}
            aria-hidden
            className={`absolute transition-[opacity,rotate,scale] duration-200 ${open ? "scale-50 rotate-90 opacity-0" : ""}`}
          />
          <X
            size={24}
            aria-hidden
            className={`absolute transition-[opacity,rotate,scale] duration-200 ${open ? "" : "scale-50 -rotate-90 opacity-0"}`}
          />
        </button>
      </div>

      {open &&
        createPortal(
          <div className="fixed inset-0 top-16 z-30 md:hidden">
            {/* Fundo escurecido: toque fora fecha. */}
            <button
              aria-label="Fechar menu"
              tabIndex={-1}
              onClick={close}
              className="absolute inset-0 animate-[fade_200ms_ease-out_both] cursor-default bg-black/50"
            />
            <div
              id={menuId}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="relative max-h-[calc(100dvh-4rem)] animate-sheet-down overflow-y-auto rounded-b-3xl bg-surface px-4 pt-3 pb-5 text-ink shadow-lift"
            >
              <nav aria-label="Principal" className="space-y-1">
                <a
                  ref={firstItem}
                  href="#"
                  aria-current="page"
                  onClick={(e) => {
                    e.preventDefault();
                    close();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="flex h-12 animate-fade-up items-center gap-3 rounded-xl bg-brand-soft px-3 font-medium text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  style={{ animationDelay: "40ms" }}
                >
                  <LayoutGrid size={20} aria-hidden /> Disciplinas
                </a>
                <a
                  href={REPORT_CARD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={close}
                  className="flex h-12 animate-fade-up items-center gap-3 rounded-xl px-3 font-medium outline-none transition-colors hover:bg-page focus-visible:ring-2 focus-visible:ring-brand"
                  style={{ animationDelay: "80ms" }}
                >
                  <ExternalLink size={20} aria-hidden className="text-muted" /> Boletim
                  <span className="ml-auto text-xs font-normal text-muted">abre na Odette</span>
                </a>
              </nav>

              <div className="my-3 h-px bg-line" />

              <button
                onClick={() => {
                  close();
                  onChangeYear();
                }}
                className="flex h-14 w-full animate-fade-up cursor-pointer items-center gap-3 rounded-xl px-3 text-left outline-none transition-colors hover:bg-page focus-visible:ring-2 focus-visible:ring-brand"
                style={{ animationDelay: "120ms" }}
              >
                <span className="grid size-9 place-items-center rounded-full bg-brand text-sm font-bold text-on-brand">{year}º</span>
                <span className="flex-1">
                  <span className="block font-medium">{year}º ano Tech</span>
                  <span className="block text-xs text-muted">Trocar de ano</span>
                </span>
                <ChevronRight size={18} aria-hidden className="text-muted" />
              </button>

              <div className="mt-3 animate-fade-up px-1" style={{ animationDelay: "160ms" }}>
                <span className="mb-2 block text-xs font-semibold text-muted">Aparência</span>
                <a href={agendaMenuUrl("settings")} className="flex items-center gap-2 rounded-xl bg-page px-3 py-3 text-ink"><Settings size={18} aria-hidden />Configurações do site</a>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </header>
  );
}
