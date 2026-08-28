import type { Rgb } from "../types";

/**
 * La palette vient de ChatGPT et change a chaque produit : la page exportee ne
 * peut plus reposer sur des couleurs ecrites en dur. On derive donc les tons
 * secondaires (surfaces, filets, ombres) a partir des cinq couleurs du brief.
 */

/** "#1B4F8A" -> {r,g,b}. Renvoie null si la chaine n'est pas un hexadecimal complet. */
export function hexToRgb(value: string): Rgb | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value.trim());
  if (!match) return null;

  const int = parseInt(match[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function toRgb(value: string): Rgb {
  return hexToRgb(value) || { r: 0, g: 0, b: 0 };
}

function toHex(color: Rgb): string {
  const part = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${part(color.r)}${part(color.g)}${part(color.b)}`;
}

/** Couleur CSS semi-transparente, pour les filets et les ombres. */
export function rgba(value: string, alpha: number): string {
  const { r, g, b } = toRgb(value);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** `ratio` = part de `to` dans le melange. mix(a, b, 0) === a. */
export function mix(from: string, to: string, ratio: number): string {
  const a = toRgb(from);
  const b = toRgb(to);
  const blend = (x: number, y: number) => x + (y - x) * ratio;
  return toHex({ r: blend(a.r, b.r), g: blend(a.g, b.g), b: blend(a.b, b.b) });
}

/** Luminance relative simplifiee : suffit pour choisir un sens d'eclaircissement. */
export function isLight(value: string): boolean {
  const { r, g, b } = toRgb(value);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
}

/**
 * Une surface qui se detache du fond quel qu'il soit : on eclaircit un fond
 * sombre, on blanchit un fond clair.
 */
export function surfaceOn(background: string): string {
  return isLight(background) ? mix(background, "#FFFFFF", 0.62) : mix(background, "#FFFFFF", 0.12);
}
