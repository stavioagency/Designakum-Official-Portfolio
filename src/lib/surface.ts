/**
 * A whole page's worth of colour, from one background hex.
 *
 * The design is built as translucent white laid over a dark ground: cards,
 * panels and the shell are all `rgba(255,255,255,…)` overlays, and the text is a
 * fixed set of light greys. Both assumptions break the moment a customer picks
 * a pale background — white on white is nothing, and light grey text on cream is
 * unreadable. So a background cannot simply be swapped; every surface and every
 * foreground has to be derived from it.
 *
 * What comes out is guaranteed legible rather than hoped to be: each text tone
 * is pushed away from the background until it clears a contrast ratio, so there
 * is no colour a customer can choose that produces text they cannot read.
 *
 * Pure and dependency-free, like accent.ts beside it, so the editor previews
 * with the same code the page renders with.
 */

import { HEX, normaliseHex } from "./accent";

export { HEX };

type Rgb = { r: number; g: number; b: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function toRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const hex2 = (v: number) => Math.round(clamp01(v / 255) * 255).toString(16).padStart(2, "0");
const toHex = ({ r, g, b }: Rgb) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

/** WCAG relative luminance. The 0.03928 branch is the sRGB transfer curve. */
export function luminance(hex: string): number {
  const { r, g, b } = toRgb(hex);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mixes toward white or black by `amount`, keeping the hue of the original. */
function shade(hex: string, amount: number): string {
  const { r, g, b } = toRgb(hex);
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  return toHex({
    r: r + (target - r) * t,
    g: g + (target - g) * t,
    b: b + (target - b) * t,
  });
}

/**
 * Walks a tone away from the background until it clears `target`.
 *
 * Stepping rather than solving: the relationship between a mix ratio and a
 * contrast ratio is not linear, and a fixed offset that works on charcoal
 * produces mud on mid-grey — the one background where nothing is far from
 * anything. Sixty steps is finer than the eye resolves and costs nothing.
 */
function ensureContrast(background: string, towardsLight: boolean, target: number): string {
  let best = background;
  for (let step = 0; step <= 60; step++) {
    const candidate = shade(background, (towardsLight ? 1 : -1) * (step / 60));
    best = candidate;
    if (contrast(candidate, background) >= target) break;
  }
  return best;
}

const rgba = (on: "light" | "dark", alpha: number) =>
  on === "dark" ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha})`;

export interface SurfaceTokens {
  /** True when black reads better on this page than white, so overlays darken. */
  isLight: boolean;
  page: string;
  text: string;
  textDim: string;
  textFaint: string;
  cardTop: string;
  cardBottom: string;
  panelFill: string;
  shellTop: string;
  shellMid: string;
  shellBottom: string;
  hairline: string;
  hairlineSoft: string;
  glass: string;
  glassStrong: string;
  insetLine: string;
  dropShadow: string;
}

/**
 * Contrast targets. 4.5 is the WCAG AA threshold for body text; the brightest
 * tone aims higher because headings carry the page, and the faintest is held to
 * 3.0, which is the AA rule for large text and the floor for anything a person
 * has to read at all.
 */
const TEXT_TARGET = 8.5;
const DIM_TARGET = 4.5;
const FAINT_TARGET = 3.0;

export function surfaceFromHex(hex: string): SurfaceTokens | null {
  const page = normaliseHex(hex);
  if (!page) return null;

  /**
   * Which way the foreground travels is decided by measuring, not by a
   * lightness threshold. A threshold gets mid-greys wrong: #808080 sits below
   * any sensible cut-off, so it is treated as dark and text goes white — where
   * it tops out at 3.95:1 and fails. Black on that same grey reaches 5.32:1.
   * Asking which direction actually wins is right everywhere, and on a
   * mid-grey it is the only thing that clears AA at all.
   */
  const towardsLight = contrast("#ffffff", page) >= contrast("#000000", page);
  const isLight = !towardsLight;
  const on = isLight ? "light" : "dark";

  // A light page needs firmer overlays than a dark one: black at the alpha that
  // reads as a gentle lift over charcoal reads as a smudge over cream.
  const a = isLight
    ? { cardTop: 0.05, cardBottom: 0.025, panel: 0.035, shell: 0.04, line: 0.12, lineSoft: 0.07, glass: 0.05, glassStrong: 0.07, inset: 0.04 }
    : { cardTop: 0.062, cardBottom: 0.028, panel: 0.032, shell: 0.05, line: 0.09, lineSoft: 0.055, glass: 0.045, glassStrong: 0.07, inset: 0.06 };

  return {
    isLight,
    page,
    text: ensureContrast(page, towardsLight, TEXT_TARGET),
    textDim: ensureContrast(page, towardsLight, DIM_TARGET),
    textFaint: ensureContrast(page, towardsLight, FAINT_TARGET),
    cardTop: rgba(on, a.cardTop),
    cardBottom: rgba(on, a.cardBottom),
    panelFill: rgba(on, a.panel),
    shellTop: rgba(on, a.shell),
    shellMid: rgba(on, a.shell * 0.3),
    shellBottom: rgba(on, a.shell * 0.6),
    hairline: rgba(on, a.line),
    hairlineSoft: rgba(on, a.lineSoft),
    glass: rgba(on, a.glass),
    glassStrong: rgba(on, a.glassStrong),
    insetLine: rgba(on, a.inset),
    // A dark page is lifted by a deep shadow; a light one only needs a hint,
    // and the same black at full strength would look like soot around a card.
    dropShadow: isLight ? "rgba(15, 18, 30, 0.14)" : "rgba(0, 0, 0, 0.9)",
  };
}

/** Inline custom properties for a portfolio that carries its own background. */
export function surfaceStyle(hex: string): React.CSSProperties | undefined {
  const s = surfaceFromHex(hex);
  if (!s) return undefined;

  return {
    "--page": s.page,
    "--text": s.text,
    "--text-dim": s.textDim,
    "--text-faint": s.textFaint,
    "--card-top": s.cardTop,
    "--card-bottom": s.cardBottom,
    "--panel-fill": s.panelFill,
    "--shell-top": s.shellTop,
    "--shell-mid": s.shellMid,
    "--shell-bottom": s.shellBottom,
    "--hairline": s.hairline,
    "--hairline-soft": s.hairlineSoft,
    "--glass": s.glass,
    "--glass-strong": s.glassStrong,
    "--inset-line": s.insetLine,
    "--drop-shadow": s.dropShadow,
    // Tells the browser which way round the page is, so form controls,
    // scrollbars and focus rings follow the customer's choice too.
    colorScheme: s.isLight ? "light" : "dark",
  } as React.CSSProperties;
}
