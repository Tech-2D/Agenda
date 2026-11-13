import { useEffect, useRef, useState } from "react";

/** Faz um número "correr" até o novo valor em vez de pular (sem animação com "reduzir movimento"). */
export function useTween(target: number, duration = 280): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current = target;
      setValue(target);
      return;
    }
    const from = current.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - k) ** 3;
      current.current = from + (target - from) * eased;
      setValue(current.current);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
