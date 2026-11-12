import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Nome para leitor de tela, quando o rótulo visível é curto (ex.: "D" → "Sala D"). */
  ariaLabel?: string;
}

interface Props<T extends string> {
  options: SegmentedOption<T>[];
  /** Opção escolhida; um valor fora da lista esconde o indicador (nada escolhido). */
  value: T | "";
  onChange: (value: T) => void;
  ariaLabel: string;
  /** "radio" para escolha única com rótulo de grupo (padrão); "pressed" para botões de alternar. */
  semantics?: "radio" | "pressed";
  /** Fundo do trilho, cantos e espaçamento. */
  className?: string;
  /** Forma do indicador que desliza (deve casar com os cantos dos botões). */
  indicatorClassName?: string;
  buttonClassName?: string;
}

// Efeito "líquido": a borda da frente sai rápido e a de trás vem depois, com um quique no fim.
// Toca mesmo com "reduzir movimento" ligado: é curto, só acontece no clique e foi pedido assim.
const LEAD = "300ms cubic-bezier(0.3, 1.35, 0.6, 1)";
const TRAIL = "520ms cubic-bezier(0.3, 1.25, 0.55, 1) 70ms";
const FADE = "opacity 200ms ease-out";

/**
 * Controle segmentado em que o fundo da opção escolhida desliza até a nova opção.
 * Mede a posição e a largura do botão ativo, então funciona com rótulos de tamanhos diferentes.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  semantics = "radio",
  className = "",
  indicatorClassName = "rounded-full bg-brand shadow-lift",
  buttonClassName = "",
}: Props<T>) {
  const track = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number; right: number } | null>(null);
  // Para que lado andou na última troca: decide qual borda vai na frente.
  const [dir, setDir] = useState<1 | -1>(1);
  const lastX = useRef<number | null>(null);
  // Só anima depois da primeira medida: na montagem o indicador já nasce no lugar certo.
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const el = value ? buttons.current.get(value as T) : undefined;
      if (!el || !track.current) return setBox(null);
      const x = el.offsetLeft;
      if (lastX.current !== null && x !== lastX.current) setDir(x > lastX.current ? 1 : -1);
      lastX.current = x;
      setBox({ x, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, right: track.current.clientWidth - x - el.offsetWidth });
    };
    measure();
    // Observa o trilho e cada botão: a largura muda quando a fonte termina de carregar.
    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    buttons.current.forEach((b) => ro.observe(b));
    return () => ro.disconnect();
  }, [value, options.length]);

  useLayoutEffect(() => {
    if (!box || ready) return;
    const t = window.setTimeout(() => setReady(true), 50);
    return () => window.clearTimeout(t);
  }, [box, ready]);

  return (
    <div
      ref={track}
      role={semantics === "radio" ? "radiogroup" : "group"}
      aria-label={ariaLabel}
      className={`relative isolate flex ${className}`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute -z-10 ${indicatorClassName} ${box ? "opacity-100" : "opacity-0"}`}
        style={{
          left: box?.x ?? 0,
          right: box?.right ?? 0,
          top: box?.y ?? 0,
          height: box?.h ?? 0,
          transition: ready ? (dir === 1 ? `right ${LEAD}, left ${TRAIL}, ${FADE}` : `left ${LEAD}, right ${TRAIL}, ${FADE}`) : "none",
        }}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              if (el) buttons.current.set(o.value, el);
              else buttons.current.delete(o.value);
            }}
            type="button"
            role={semantics === "radio" ? "radio" : undefined}
            aria-checked={semantics === "radio" ? active : undefined}
            aria-pressed={semantics === "pressed" ? active : undefined}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={`relative cursor-pointer whitespace-nowrap outline-none transition-[color,transform] duration-300 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand ${
              active ? "text-white" : "text-ink hover:text-brand"
            } ${buttonClassName}`}
          >
            {/* O rótulo escolhido dá um "pulo" quando o fundo chega nele. */}
            <span key={active ? "on" : "off"} className={`inline-block ${active && ready ? "animate-pop [animation-delay:120ms]" : ""}`}>
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
