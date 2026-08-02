import type { Step } from '../algorithms/types';

/**
 * Renders the number grid and applies steps to it.
 * Tiles are held in an array — no id lookups, no way to touch a stale DOM.
 *
 * Each tile carries two SVG marks used by the Notebook theme: a hand-ruled
 * strike line and a pencil ring for primes. A few path variants, picked by
 * value, keep the lines from looking machine-identical. Signal hides both
 * and speaks in background/glow instead — all of that lives in CSS.
 */

const STRIKES = [
  'M8 55 C 30 51, 62 48, 92 45',
  'M7 47 C 32 50, 66 53, 93 50',
  'M8 52 C 40 45, 70 48, 92 53',
  'M7 49 C 28 55, 64 43, 93 48',
  'M9 45 C 34 49, 60 52, 91 55',
];

const RINGS = [
  'M50 15 C 71 13, 86 27, 86 48 C 86 71, 69 86, 47 85 C 26 84, 13 68, 14 46 C 15 27, 31 16, 53 15 C 60 15, 66 17, 71 21',
  'M46 14 C 68 11, 87 25, 87 47 C 87 70, 71 87, 48 86 C 25 85, 12 69, 13 46 C 14 25, 29 15, 50 14 C 58 14, 64 15, 69 18',
  'M52 16 C 72 15, 85 29, 85 49 C 85 70, 70 85, 48 85 C 27 85, 14 70, 14 48 C 14 28, 30 17, 51 15 C 59 15, 67 18, 72 22',
];

function tileMarkup(value: number): string {
  const strike = STRIKES[value % STRIKES.length];
  const ring = RINGS[value % RINGS.length];
  return (
    `<span class="tile-num">${value}</span>` +
    `<svg class="tile-strike" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">` +
    `<path d="${strike}" pathLength="1" vector-effect="non-scaling-stroke"/></svg>` +
    `<svg class="tile-ring" viewBox="0 0 100 100" aria-hidden="true">` +
    `<path d="${ring}" pathLength="1" vector-effect="non-scaling-stroke"/></svg>`
  );
}

export class Grid {
  private tiles: HTMLElement[] = [];
  private cursorTile: HTMLElement | null = null;
  private cursorValue: number | null = null;
  private ring: HTMLElement | null = null;

  constructor(private root: HTMLElement) {}

  build(n: number): void {
    this.root.textContent = '';
    this.cursorTile = null;
    this.cursorValue = null;
    this.tiles = [];
    const frag = document.createDocumentFragment();
    for (let value = 0; value < n; value++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.innerHTML = tileMarkup(value);
      frag.appendChild(tile);
      this.tiles.push(tile);
    }
    const ring = document.createElement('div');
    ring.className = 'cursor-ring';
    ring.hidden = true;
    frag.appendChild(ring);
    this.ring = ring;
    this.root.appendChild(frag);
  }

  clear(): void {
    this.root.textContent = '';
    this.tiles = [];
    this.cursorTile = null;
    this.cursorValue = null;
    this.ring = null;
  }

  /** Re-seats the cursor ring after a resize reflows the tiles. */
  relayout(): void {
    if (this.cursorValue !== null) this.placeRing(this.cursorValue, true);
  }

  apply(step: Step): void {
    switch (step.kind) {
      case 'init':
        this.build(step.n);
        break;
      case 'strike-units':
        this.mark(0, 'struck');
        this.mark(1, 'struck');
        break;
      case 'prime-found':
        this.moveCursor(step.i);
        break;
      case 'composite-skip':
        this.moveCursor(step.i);
        break;
      case 'strike':
        this.mark(step.value, 'struck');
        this.flash(step.value);
        break;
      case 'sweep-done':
        this.moveCursor(null);
        break;
      case 'count-visit':
        this.moveCursor(step.i);
        if (step.prime) this.mark(step.i, 'prime');
        break;
      case 'done':
        this.moveCursor(null);
        break;
    }
  }

  private tile(value: number): HTMLElement | null {
    return this.tiles[value] ?? null;
  }

  private mark(value: number, cls: 'struck' | 'prime'): void {
    this.tile(value)?.classList.add(cls);
  }

  private flash(value: number): void {
    const el = this.tile(value);
    if (el === null) return;
    el.classList.remove('flash');
    // restart the CSS animation if the class was already present
    void el.offsetWidth;
    el.classList.add('flash');
  }

  private moveCursor(value: number | null): void {
    this.cursorTile?.classList.remove('cursor');
    this.cursorTile = value === null ? null : this.tile(value);
    this.cursorTile?.classList.add('cursor');
    if (value === null || this.cursorTile === null) {
      this.cursorValue = null;
      if (this.ring !== null) this.ring.hidden = true;
      return;
    }
    this.placeRing(value, this.cursorValue === null);
    this.cursorValue = value;
  }

  /** Glides the ring to a tile; `snap` skips the transition (first show, resize). */
  private placeRing(value: number, snap: boolean): void {
    const ring = this.ring;
    const tile = this.tile(value);
    if (ring === null || tile === null) return;
    ring.hidden = false;
    if (snap) ring.style.transition = 'none';
    ring.style.width = `${tile.offsetWidth}px`;
    ring.style.height = `${tile.offsetHeight}px`;
    ring.style.transform = `translate(${tile.offsetLeft}px, ${tile.offsetTop}px)`;
    if (snap) {
      void ring.offsetWidth;
      ring.style.transition = '';
    }
  }
}
