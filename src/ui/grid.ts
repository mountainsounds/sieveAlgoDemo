import type { Step } from '../algorithms/types';

/**
 * Renders the number grid and applies steps to it.
 * Tiles are held in an array — no id lookups, no way to touch a stale DOM.
 */
export class Grid {
  private tiles: HTMLElement[] = [];
  private cursor: HTMLElement | null = null;

  constructor(private root: HTMLElement) {}

  build(n: number): void {
    this.root.textContent = '';
    this.cursor = null;
    this.tiles = [];
    const frag = document.createDocumentFragment();
    for (let value = 0; value < n; value++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.textContent = String(value);
      frag.appendChild(tile);
      this.tiles.push(tile);
    }
    this.root.appendChild(frag);
  }

  clear(): void {
    this.root.textContent = '';
    this.tiles = [];
    this.cursor = null;
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
    this.cursor?.classList.remove('cursor');
    this.cursor = value === null ? null : this.tile(value);
    this.cursor?.classList.add('cursor');
  }
}
