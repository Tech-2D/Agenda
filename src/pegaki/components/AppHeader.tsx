import { agendaMenuUrl } from "../../menuShortcuts";
import { ChevronDown, GraduationCap, Settings } from "lucide-react";

export function AppHeader({ year, onChangeYear }: { year: number; onChangeYear: () => void }) {
  return (
    <header className="sticky top-0 z-30 animate-slide-down bg-brand text-on-brand shadow-md dark:border-b dark:border-line dark:bg-surface dark:text-ink dark:shadow-none">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <GraduationCap aria-hidden size={28} /> Notaki
        </div>
        <div className="flex items-center gap-2">
          <a href={agendaMenuUrl("settings")} className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm md:inline-flex" aria-label="Configurações de aparência do site">
            <Settings size={18} aria-hidden /> Aparência
          </a>
          <button
            type="button"
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
      </div>
    </header>
  );
}
