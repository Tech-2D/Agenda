import { ArrowRight, GraduationCap, Lock } from "lucide-react";
import { SUBJECTS_BY_YEAR, YEARS, type Year } from "../data/subjects";

export function YearPicker({ onPick }: { onPick: (y: Year) => void }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="relative overflow-hidden bg-brand px-4 pt-10 pb-28 text-on-brand sm:pt-14 sm:pb-36">
        <div aria-hidden className="absolute -top-24 -right-24 size-72 animate-float rounded-full bg-white/10" />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 size-80 animate-float rounded-full bg-white/5"
          style={{ animationDelay: "-4s", animationDuration: "12s" }}
        />
        <div className="relative mx-auto max-w-3xl animate-fade-up text-center">
          <div className="mb-6 inline-flex items-center gap-2 text-lg font-semibold">
            <GraduationCap size={30} aria-hidden /> Notaki
          </div>
          <h1 className="text-2xl font-semibold sm:text-4xl">De qual ano do Tech você é?</h1>
          <p className="mt-3 text-sm text-on-brand/80 sm:text-base">
            Escolha seu ano para carregar as disciplinas e calcular se você passou.
          </p>
        </div>
      </div>

      <main className="relative z-10 mx-auto -mt-20 grid w-full max-w-3xl gap-4 px-4 pb-10 sm:-mt-24 sm:grid-cols-3">
        {YEARS.map((y, i) => {
          const count = SUBJECTS_BY_YEAR[y].length;
          const ready = count > 0;
          return (
            <button
              key={y}
              onClick={() => ready && onPick(y)}
              disabled={!ready}
              style={{ animationDelay: `${150 + i * 90}ms` }}
              className="group flex animate-fade-up items-center gap-4 rounded-2xl bg-surface p-5 text-left shadow-card outline-none transition-[transform,box-shadow] duration-200 focus-visible:ring-4 focus-visible:ring-brand/40 enabled:cursor-pointer enabled:hover:-translate-y-1.5 enabled:hover:shadow-lift enabled:active:scale-[0.98] disabled:cursor-not-allowed sm:flex-col sm:items-start sm:p-6"
            >
              <span
                className={`grid size-14 shrink-0 place-items-center rounded-xl text-2xl font-bold transition-[background-color,color,transform] duration-300 sm:size-16 sm:text-3xl ${
                  ready
                    ? "bg-brand-soft text-brand-ink group-hover:rotate-[-6deg] group-hover:bg-brand group-hover:text-on-brand"
                    : "bg-ink/5 text-muted"
                }`}
              >
                {y}º
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-lg font-semibold ${ready ? "" : "text-muted"}`}>{y}º ano Tech</span>
                <span className="block text-sm text-muted">{ready ? `${count} disciplinas` : "Em breve"}</span>
              </span>
              {ready ? (
                <ArrowRight
                  size={20}
                  aria-hidden
                  className="text-muted transition-transform duration-200 group-hover:translate-x-1.5 group-hover:text-brand-ink sm:self-end"
                />
              ) : (
                <Lock size={18} aria-hidden className="text-muted sm:self-end" />
              )}
            </button>
          );
        })}
      </main>
    </div>
  );
}
