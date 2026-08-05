import type { AlgorithmView, ControlValues } from '../../algorithms/types';
import { arrangeValues, ORDER, SIZE, type SortStep } from '../../algorithms/insertion-sort';

/**
 * Renders insertion sort as a deck of columns that actually reorders. Where
 * the search view leaves its bars where they are and takes them out of play,
 * here movement *is* the algorithm, so the marks are its own:
 *
 * - the key is **lifted out** of the row and floats above a dashed **hole**
 *   marking the slot it left, and the hole travels left with it;
 * - a short **guide** at the key's height reaches over its left neighbour, so
 *   "taller than the key?" is something you read off the picture;
 * - a shifted column **slides** a slot right, flicking an arrow as it goes;
 * - the **band** and its **seam** hold the sorted-so-far boundary, growing a
 *   slot per pass, and sorted columns take the accent while the rest stay grey.
 *
 * Slots are percentages of the row, so a resize needs no work. As in the other
 * views the Notebook-only SVG marks stay rendered but hidden in Signal, so a
 * mid-run theme switch never replays a draw.
 */

/* Quick pencil flicks under a column that just moved; two variants so a long
   cascade doesn't look stamped. */
const ARROWS = [
  'M2 6.4 C 7 5.6, 12 5.4, 18 5.2 M14.4 2.2 C 15.8 3.4, 17.2 4.6, 19.4 5.3 C 17.4 6.2, 15.8 7.4, 14.4 8.6',
  'M2.4 5.6 C 8 6.4, 13 6, 18.2 6.2 M14.8 3 C 16 4.2, 17.4 5.3, 19.6 6.2 C 17.6 7, 16 8.2, 14.6 9.4',
];

const RISE_STAGGER_MS = 14;

function columnMarkup(index: number): string {
  const arrow = ARROWS[index % ARROWS.length];
  return (
    `<svg class="col-arrow" viewBox="0 0 22 12" aria-hidden="true">` +
    `<path d="${arrow}" pathLength="1" vector-effect="non-scaling-stroke"/></svg>`
  );
}

export class SortView implements AlgorithmView {
  private columns: HTMLElement[] = [];
  /** slots[s] is the column standing in slot s, or null while the gap is there. */
  private slots: (HTMLElement | null)[] = [];
  private n = 0;
  private signature = '';
  /** Set once a run has moved anything, so the next preview rebuilds the deck. */
  private dirty = false;
  private keyColumn: HTMLElement | null = null;
  private keyValue = 0;
  private comparedColumn: HTMLElement | null = null;
  private placedColumn: HTMLElement | null = null;
  private row: HTMLElement;
  private band: HTMLElement;
  private seam: HTMLElement;
  private hole: HTMLElement;
  private guide: HTMLElement;
  private tag: HTMLElement;
  private legend: HTMLElement;
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private root: HTMLElement) {
    root.className = 'sort';
    root.innerHTML =
      `<div class="deck"><div class="row">` +
      `<div class="band" hidden></div>` +
      `<div class="seam" hidden></div>` +
      `<div class="hole" hidden></div>` +
      `<div class="guide" hidden></div>` +
      `<div class="key-tag" hidden></div>` +
      `</div></div>` +
      `<div class="legend"><span class="legend-lo">sorted</span>` +
      `<span class="legend-hi">unsorted</span></div>`;
    this.row = this.part('.row');
    this.band = this.part('.band');
    this.seam = this.part('.seam');
    this.hole = this.part('.hole');
    this.guide = this.part('.guide');
    this.tag = this.part('.key-tag');
    this.legend = this.part('.legend');
  }

  private part(selector: string): HTMLElement {
    const node = this.root.querySelector<HTMLElement>(selector);
    if (node === null) throw new Error(`missing ${selector}`);
    return node;
  }

  preview(values: ControlValues): void {
    const size = values['size'] ?? SIZE.default;
    const order = values['order'] ?? ORDER.shuffled;
    const signature = `${size}:${order}`;
    if (signature !== this.signature || this.dirty) {
      this.signature = signature;
      this.buildDeck(arrangeValues(size, order));
    }
    this.resetRun();
  }

  apply(raw: unknown): void {
    // Only steps from insertion sort's buildSteps ever reach this view.
    const step = raw as SortStep;
    this.dirty = true;
    switch (step.kind) {
      case 'init':
        this.signature = '';
        this.buildDeck(step.values);
        this.resetRun();
        break;
      case 'seed':
        this.legend.classList.add('on');
        this.setSorted(0);
        break;
      case 'pick':
        this.pick(step.i, step.key);
        break;
      case 'compare':
        this.compare(step.j, step.verdict);
        break;
      case 'wall':
        this.clearCompared();
        break;
      case 'shift':
        this.shift(step.from, step.to);
        break;
      case 'place':
        this.place(step.slot);
        break;
      case 'done':
        this.finish();
        break;
    }
  }

  /** Every marker is placed in percentages of the row, so a resize needs no work. */
  relayout(): void {}

  destroy(): void {
    this.root.textContent = '';
    this.root.className = '';
    this.columns = [];
    this.slots = [];
    this.keyColumn = null;
    this.comparedColumn = null;
    this.placedColumn = null;
  }

  private buildDeck(values: readonly number[]): void {
    for (const column of this.columns) column.remove();
    this.columns = [];
    this.n = values.length;
    this.row.style.setProperty('--n', String(this.n));
    const frag = document.createDocumentFragment();
    const skipRise = this.reduced.matches;
    values.forEach((value, index) => {
      const column = document.createElement('div');
      column.className = 'col';
      column.style.setProperty('--h', String(value));
      if (!skipRise) column.style.setProperty('--rise-delay', `${index * RISE_STAGGER_MS}ms`);
      column.innerHTML = columnMarkup(index);
      this.setSlot(column, index);
      frag.appendChild(column);
      this.columns.push(column);
    });
    this.row.appendChild(frag);
    this.slots = this.columns.slice();
    this.dirty = false;
  }

  private resetRun(): void {
    for (const column of this.columns) {
      column.classList.remove('key', 'cmp', 'sorted', 'placed', 'shifting');
    }
    this.keyColumn = null;
    this.comparedColumn = null;
    this.placedColumn = null;
    this.band.hidden = true;
    this.seam.hidden = true;
    this.hole.hidden = true;
    this.guide.hidden = true;
    this.tag.hidden = true;
    this.legend.classList.remove('on', 'done');
  }

  private slotPercent(slot: number): number {
    return this.n === 0 ? 0 : (slot / this.n) * 100;
  }

  private setSlot(column: HTMLElement, slot: number): void {
    column.style.left = `${this.slotPercent(slot)}%`;
  }

  private pick(i: number, key: number): void {
    this.placedColumn?.classList.remove('placed');
    this.placedColumn = null;
    const column = this.slots[i];
    if (column === undefined || column === null) return;
    column.classList.add('key');
    this.keyColumn = column;
    this.keyValue = key;
    this.slots[i] = null;
    this.moveGap(i, key);
    // The run claims this slot for the whole pass; the hole shows the work left.
    this.setSorted(i);
  }

  /** Seats the hole, the floating key, its tag, and the guide on one slot. */
  private moveGap(slot: number, key: number): void {
    const left = `${this.slotPercent(slot)}%`;
    this.hole.style.left = left;
    this.hole.hidden = false;
    this.keyColumn?.style.setProperty('left', left);
    this.tag.style.setProperty('--x', `${this.slotPercent(slot + 0.5)}%`);
    this.tag.textContent = `key = ${key}`;
    this.tag.hidden = false;
    // The guide lies across the neighbour about to be compared. At slot 0
    // there is no neighbour left, so it comes off the board entirely.
    this.guide.style.left = `${this.slotPercent(slot - 1)}%`;
    this.guide.style.bottom = `${key}%`;
    this.guide.classList.remove('stop');
    this.guide.hidden = slot === 0;
  }

  private compare(j: number, verdict: 'shift' | 'stop'): void {
    this.clearCompared();
    const column = this.slots[j];
    if (column !== undefined && column !== null) {
      column.classList.add('cmp');
      this.comparedColumn = column;
    }
    this.guide.classList.toggle('stop', verdict === 'stop');
  }

  private clearCompared(): void {
    this.comparedColumn?.classList.remove('cmp');
    this.comparedColumn = null;
  }

  private shift(from: number, to: number): void {
    const column = this.slots[from];
    if (column === undefined || column === null) return;
    this.clearCompared();
    this.slots[to] = column;
    this.slots[from] = null;
    this.setSlot(column, to);
    this.flick(column);
    // The gap — and the key floating over it — follow the shifted column left.
    if (this.keyColumn !== null) this.moveGap(from, this.keyValue);
  }

  /** Restarts the slide mark even when the column moved on the previous step. */
  private flick(column: HTMLElement): void {
    column.classList.remove('shifting');
    void column.offsetWidth;
    column.classList.add('shifting');
  }

  private place(slot: number): void {
    this.clearCompared();
    const column = this.keyColumn;
    if (column !== null) {
      column.classList.remove('key');
      column.classList.add('placed', 'sorted');
      this.setSlot(column, slot);
      this.slots[slot] = column;
      this.placedColumn = column;
    }
    this.keyColumn = null;
    this.hole.hidden = true;
    this.guide.hidden = true;
    this.tag.hidden = true;
  }

  /** Grows the sorted band and its seam to cover slots 0 through `through`. */
  private setSorted(through: number): void {
    const percent = this.slotPercent(through + 1);
    this.band.hidden = false;
    this.band.style.width = `${percent}%`;
    this.seam.hidden = false;
    this.seam.style.left = `calc(${percent}% - 3px)`;
    for (let slot = 0; slot <= through; slot++) this.slots[slot]?.classList.add('sorted');
  }

  private finish(): void {
    this.clearCompared();
    this.placedColumn?.classList.remove('placed');
    this.placedColumn = null;
    for (const column of this.columns) column.classList.add('sorted');
    this.band.hidden = false;
    this.band.style.width = '100%';
    // Nothing is left on the far side, so the boundary retires with the run.
    this.seam.hidden = true;
    this.legend.classList.add('done');
  }
}
