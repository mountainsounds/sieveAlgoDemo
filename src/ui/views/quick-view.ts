import type { AlgorithmView, ControlValues } from '../../algorithms/types';
import { arrangeValues, ORDER } from '../../algorithms/arrange';
import { SIZE, type QuickStep, type Range } from '../../algorithms/quick-sort';

/**
 * Renders quicksort as one row of columns that swap places, plus a rail that
 * draws the call stack.
 *
 * Insertion sort grows a sorted prefix and merge sort sweeps whole levels, so
 * both have a boundary that only ever moves one way. Quicksort has neither: it
 * jumps around the row, and what it finishes is a *scatter* of single values.
 * So the marks are its own:
 *
 * - the **range** wash covers only the slice being partitioned, and it jumps
 *   and shrinks rather than growing;
 * - the **pivot** is outlined and tagged, and when it settles it turns into a
 *   **locked** column — final, never touched again, wherever it happens to be;
 * - the **boundary** (i) and the **scanner** (j) are two cursors under the row,
 *   and the gap between them is exactly the run of values not yet sorted into
 *   a side;
 * - a swap is the two columns **trading places**, because that is the motion;
 * - the **rail** draws the current frame solid and every range still on the
 *   stack hollow. They never overlap, so recursion depth reads as "how much is
 *   still queued" without drawing a single nested box.
 *
 * Slots are percentages of the row, so a resize needs no work.
 */

export class QuickView implements AlgorithmView {
  private columns: HTMLElement[] = [];
  /** slots[s] is the column standing in slot s. */
  private slots: HTMLElement[] = [];
  private n = 0;
  private signature = '';
  /** Set once a run has moved anything, so the next preview rebuilds the row. */
  private dirty = false;
  private testingColumn: HTMLElement | null = null;
  private row: HTMLElement;
  private range: HTMLElement;
  private tag: HTMLElement;
  private bound: HTMLElement;
  private scanner: HTMLElement;
  private rail: HTMLElement;
  private current: HTMLElement;
  private legend: HTMLElement;
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private root: HTMLElement) {
    root.className = 'quick';
    root.innerHTML =
      `<div class="qdeck"><div class="row">` +
      `<div class="range" hidden></div>` +
      `<div class="pivot-tag" hidden></div>` +
      `<div class="bound" hidden></div>` +
      `<div class="scanner" hidden></div>` +
      `</div>` +
      `<div class="rail"><div class="frame current" hidden></div></div></div>` +
      `<div class="legend"><span class="legend-lo">settled</span>` +
      `<span class="legend-hi">still to sort</span></div>`;
    this.row = this.part('.row');
    this.range = this.part('.range');
    this.tag = this.part('.pivot-tag');
    this.bound = this.part('.bound');
    this.scanner = this.part('.scanner');
    this.rail = this.part('.rail');
    this.current = this.part('.frame.current');
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
      this.buildRow(arrangeValues(size, order));
    }
    this.resetRun();
  }

  apply(raw: unknown): void {
    // Only steps from quicksort's buildSteps ever reach this view.
    const step = raw as QuickStep;
    this.dirty = true;
    switch (step.kind) {
      case 'init':
        this.signature = '';
        this.buildRow(step.values);
        this.resetRun();
        break;
      case 'call':
        this.enter(step.lo, step.hi, step.pending);
        break;
      case 'guard':
        if (step.trivial) this.range.classList.add('spent');
        break;
      case 'pivot':
        this.markPivot(step.index, step.value, step.lo);
        break;
      case 'scan':
        this.scan(step.j, step.i, step.less);
        break;
      case 'swap':
        this.swap(step.i, step.j, step.moved);
        break;
      case 'settle':
        this.settle(step.index, step.hi);
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
    this.testingColumn = null;
  }

  private buildRow(values: readonly number[]): void {
    for (const column of this.columns) column.remove();
    this.columns = [];
    this.n = values.length;
    this.row.style.setProperty('--n', String(this.n));
    const frag = document.createDocumentFragment();
    const skipRise = this.reduced.matches;
    values.forEach((value, index) => {
      const column = document.createElement('div');
      column.className = 'qcol';
      column.style.setProperty('--h', String(value));
      if (!skipRise) column.style.setProperty('--rise-delay', `${index * 14}ms`);
      this.seat(column, index);
      frag.appendChild(column);
      this.columns.push(column);
    });
    this.row.appendChild(frag);
    this.slots = this.columns.slice();
    this.dirty = false;
  }

  private resetRun(): void {
    for (const column of this.columns) {
      column.classList.remove('low', 'pivot', 'testing', 'locked', 'final', 'swapping');
    }
    this.testingColumn = null;
    this.range.hidden = true;
    this.tag.hidden = true;
    this.bound.hidden = true;
    this.scanner.hidden = true;
    this.current.hidden = true;
    this.current.classList.remove('empty');
    this.clearPending();
    this.legend.classList.remove('on', 'done');
  }

  private percent(slot: number): number {
    return this.n === 0 ? 0 : (slot / this.n) * 100;
  }

  private seat(column: HTMLElement, slot: number): void {
    column.style.left = `${this.percent(slot)}%`;
  }

  /**
   * Spans an inclusive slot range as left/width percentages. An empty range
   * spans no columns, so it gets a tick instead of a bar — a call that will do
   * nothing is still a call on the stack, and in the worst case most of them
   * are exactly that.
   */
  private span(target: HTMLElement, lo: number, hi: number): void {
    const empty = hi < lo;
    target.classList.toggle('empty', empty);
    target.style.left = `${this.percent(lo)}%`;
    target.style.width = empty ? '' : `${this.percent(hi - lo + 1)}%`;
  }

  private enter(lo: number, hi: number, pending: readonly Range[]): void {
    this.legend.classList.add('on');
    this.clearLow();
    this.tag.hidden = true;
    this.bound.hidden = true;
    this.scanner.hidden = true;
    this.range.classList.remove('spent');
    // An empty range has no columns to wash, but it is still the frame the
    // run is standing in, so the rail keeps showing it as a tick.
    const empty = lo > hi;
    this.range.hidden = empty;
    if (!empty) this.span(this.range, lo, hi);
    this.current.hidden = false;
    this.span(this.current, lo, hi);
    this.clearPending();
    for (const [from, to] of pending) {
      const frame = document.createElement('div');
      frame.className = 'frame pending';
      this.span(frame, from, to);
      this.rail.appendChild(frame);
    }
  }

  private clearPending(): void {
    for (const frame of Array.from(this.rail.querySelectorAll('.frame.pending'))) frame.remove();
  }

  private markPivot(index: number, value: number, lo: number): void {
    const column = this.slots[index];
    if (column === undefined) return;
    column.classList.add('pivot');
    this.tag.style.setProperty('--x', `${this.percent(index + 0.5)}%`);
    this.tag.style.setProperty('--h', String(value));
    // The pivot is the last value in its range, so it is often the last column
    // on the row; centring the tag there would push it off the edge.
    const across = this.n === 0 ? 0 : (index + 0.5) / this.n;
    this.tag.style.setProperty(
      '--tag-shift',
      across > 0.72 ? '-100%' : across < 0.28 ? '0%' : '-50%',
    );
    this.tag.textContent = `pivot = ${value}`;
    this.tag.hidden = false;
    // Both cursors start at the low end: nothing is on the low side yet.
    this.moveBound(lo);
    this.bound.hidden = false;
  }

  private scan(j: number, i: number, less: boolean): void {
    this.testingColumn?.classList.remove('testing');
    const column = this.slots[j];
    if (column !== undefined) {
      column.classList.add('testing');
      this.testingColumn = column;
    }
    this.moveScanner(j);
    this.scanner.classList.toggle('low', less);
    this.scanner.hidden = false;
    this.moveBound(i);
  }

  /** The boundary is a divider: it sits on the edge before slot `i`. */
  private moveBound(slot: number): void {
    this.bound.style.left = `${this.percent(slot)}%`;
  }

  /** The scanner points at one column, so it sits on that slot's centre. */
  private moveScanner(slot: number): void {
    this.scanner.style.left = `${this.percent(slot + 0.5)}%`;
  }

  private swap(i: number, j: number, moved: boolean): void {
    const low = this.slots[i];
    const high = this.slots[j];
    if (low === undefined || high === undefined) return;
    if (moved) {
      this.slots[i] = high;
      this.slots[j] = low;
      this.seat(high, i);
      this.seat(low, j);
      this.flick(high);
      this.flick(low);
    }
    // Either way the value at i is now known to be below the pivot.
    this.slots[i]?.classList.add('low');
    this.slots[i]?.classList.remove('testing');
    this.testingColumn = this.slots[j] ?? null;
    this.moveBound(i + 1);
  }

  /** Restarts the swap mark even when the column moved on the previous step. */
  private flick(column: HTMLElement): void {
    column.classList.remove('swapping');
    void column.offsetWidth;
    column.classList.add('swapping');
  }

  private settle(index: number, hi: number): void {
    this.testingColumn?.classList.remove('testing');
    this.testingColumn = null;
    const pivot = this.slots[hi];
    const displaced = this.slots[index];
    if (pivot !== undefined && displaced !== undefined && index !== hi) {
      this.slots[index] = pivot;
      this.slots[hi] = displaced;
      this.seat(pivot, index);
      this.seat(displaced, hi);
      this.flick(pivot);
      this.flick(displaced);
    }
    const settled = this.slots[index];
    settled?.classList.remove('pivot', 'low', 'testing');
    settled?.classList.add('locked');
    this.clearLow();
    this.tag.hidden = true;
    this.bound.hidden = true;
    this.scanner.hidden = true;
  }

  private clearLow(): void {
    for (const column of this.columns) column.classList.remove('low');
  }

  private finish(): void {
    this.testingColumn?.classList.remove('testing');
    this.testingColumn = null;
    for (const column of this.columns) {
      column.classList.remove('low', 'pivot', 'testing', 'locked');
      column.classList.add('final');
    }
    // Nothing is queued and nothing is in play, so both retire with the run.
    this.range.hidden = true;
    this.current.hidden = true;
    this.clearPending();
    this.tag.hidden = true;
    this.bound.hidden = true;
    this.scanner.hidden = true;
    this.legend.classList.add('done');
  }
}
