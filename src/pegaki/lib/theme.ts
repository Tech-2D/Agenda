import { useEffect, useState } from "react";

/** Preferência de tema: claro, escuro ou seguir o sistema. */
export type ThemePref = "light" | "dark" | "system";

// Texto puro (não JSON) para o script do index.html conseguir ler antes da primeira pintura.
const KEY = "aprovae:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
// Cor da barra do navegador no celular, combinando com o cabeçalho de cada tema.
const BAR_COLOR = { light: "#0a2dc4", dark: "#161a22" };

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function resolve(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function apply(pref: ThemePref, animate: boolean) {
  const root = document.documentElement;
  const theme = resolve(pref);
  if (root.dataset.theme === theme) return;
  // Na troca, as cores cruzam suavemente em vez de piscar.
  if (animate) {
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 320);
  }
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR_COLOR[theme]);
}

/** Tema atual e como trocá-lo; a escolha fica salva e "Automático" acompanha o sistema ao vivo. */
export function useTheme(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(readPref);

  useEffect(() => {
    apply(pref, true);
    try {
      if (pref === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, pref);
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
    if (pref !== "system") return;
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = () => apply("system", true);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  return [pref, setPref];
}
