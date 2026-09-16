/**
 * A custom accent colour, from one hex value.
 *
 * The themes each carry three colours — the two ends of a gradient and a
 * brighter ring — because one flat colour looks dead next to them. Asking a
 * customer for three hex codes would be asking them to do colour theory; asking
 * for one and deriving the rest keeps their page looking like it belongs on the
 * platform.
 *
 * Pure and dependency-free so the editor can preview the result while someone
 * types, running the same code the page will run.
 */

export const HEX = /^#?([0-9a-fA-F]{6})$/;

export function normaliseHex(input: string): string | null {
  const match = HEX.exec(input.trim());
  return match ? `#${match[1].toLowerCase()}` : null;
}

type Hsl = { h: number; s: number; l: number };

function toHsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return { h: 0, s: 0, l };

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;

  return { h: h * 60, s, l };
}

function toHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];

  const channel = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** The three variables a theme sets, derived from one colour. */
export function accentFromHex(hex: string): {
  from: string;
  to: string;
  ring: string;
} | null {
  const base = normaliseHex(hex);
  if (!base) return null;

  const hsl = toHsl(base);
  return {
    from: base,
    // The gradient's far end: darker, and a little richer so it does not go grey.
    to: toHex({ ...hsl, l: clamp(hsl.l - 0.14), s: clamp(hsl.s + 0.04) }),
    // The ring reads as light against a dark page, so it needs a floor — a very
    // dark accent would otherwise produce a ring nobody can see.
    ring: toHex({ ...hsl, l: Math.max(0.62, clamp(hsl.l + 0.2)) }),
  };
}

/** Inline custom properties for a portfolio that carries its own colour. */
export function accentStyle(hex: string): React.CSSProperties | undefined {
  const accent = accentFromHex(hex);
  if (!accent) return undefined;
  return {
    "--accent-from": accent.from,
    "--accent-to": accent.to,
    "--accent-ring": accent.ring,
  } as React.CSSProperties;
}
