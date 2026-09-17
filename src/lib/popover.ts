/**
 * Where a panel hung off a button goes, measured against the viewport.
 *
 * Pure, and its own module, because the bug it exists to stop is arithmetic:
 * the console keeps the notifications bell at the *bottom* of the sidebar, a
 * panel opened downwards from there began below the fold, and nothing appeared
 * on screen at all. That is not something you can see in a unit test of a React
 * component, but it is something you can assert about four numbers.
 */

export interface Anchor {
  top: number;
  bottom: number;
  right: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface Placement {
  left: number;
  width: number;
  /** Never taller than the room it has. */
  maxHeight: number;
  top?: number;
  bottom?: number;
}

/** Below this the panel is a sliver, and the other side is worth trying. */
const COMFORTABLE = 280;
/** Below this there is nowhere good, so we stop shrinking and let it scroll. */
const FLOOR = 160;

export function placePanel(
  anchor: Anchor,
  viewport: Viewport,
  { width: want = 340, margin = 12, gap = 10 } = {},
): Placement {
  const width = Math.min(want, viewport.width - margin * 2);
  // Prefer hanging from the button's own edge, then pull it back inside.
  const preferred = anchor.right - width;
  const left = Math.min(Math.max(margin, preferred), viewport.width - width - margin);

  const below = viewport.height - anchor.bottom - gap - margin;
  const above = anchor.top - gap - margin;

  // Enough room to be worth reading, or simply more room than the other side.
  if (below >= COMFORTABLE || below >= above) {
    return { left, width, top: anchor.bottom + gap, maxHeight: Math.max(FLOOR, below) };
  }
  return {
    left,
    width,
    bottom: viewport.height - anchor.top + gap,
    maxHeight: Math.max(FLOOR, above),
  };
}
