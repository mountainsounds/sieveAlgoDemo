import type { AlgorithmView, ControlValues } from '../../algorithms/types';
import { arrangeValues, ORDER } from '../../algorithms/arrange';
import { SIZE, type MergeStep, type Side } from '../../algorithms/merge-sort';

/**
 * Renders merge sort as **two lanes**, because what separates it from the
 * sorts already here is that it does not work in place: it needs a second
 * array to merge into, and hiding that would be the one dishonest choice.
 *
 * - the **top lane** is the input, cut into sorted runs by dashed seams that
 *   halve in number every level;
 * - the **bottom lane** is the auxiliary array, filled left to right;
 * - the two runs in play are told apart by fill — the left one **solid**, the
 *   right one **hollow** — and each value keeps that mark on the way down, so
 *   the output reads as a zip of two sources rather than a new row of bars;
 * - three **cursors** sit in the gap: one under each run's head pointing up,
 *   one over the write slot pointing down;
 * - a **chute** is drawn from the value taken to the slot it lands in;
 * - when a level ends a **wipe** crosses both lanes and the output rises into
 *   the top lane to become the next level's input.
 *
 * Everything is placed in percentages of the lane, so `relayout` is a no-op.
 * As in the other views the Notebook-only marks stay rendered but hidden in
 * Signal, so a mid-run theme switch never replays a draw.
 */

/** A chute across the gap's 0..100 box; two bows so a long cascade of them
    doesn't look stamped out. */
function chutePath(from: number, to: number, variant: number): string {
  const bow = variant === 0 ? 44 : 54;
  const a = from.toFixed(2);
  const b = to.toFixed(2);
  return `M${a} 2 C ${a} ${bow}, ${b} ${100 - bow}, ${b} 98`;
}

const SETTLE_STAGGER_MS = 16;

export class MergeView implements AlgorithmView {
  private srcCols: HTMLElement[] = [];
  private outCols: HTMLElement[] = [];
  private n = 0;
  private signature = '';
  /** Set once a run has changed anything, so the next preview rebuilds. */
  private dirty = false;
  /** End of the merge window in play, so the write cursor knows when to retire. */
  private hi = 0;
  private chuteVariant = 0;
  private root: HTMLElement;
  private srcLane: HTMLElement;
  private outLane: HTMLElement;
  private seams: HTMLElement;
  private chute: SVGPathElement;
  private cursorA: HTMLElement;
  private cursorB: HTMLElement;
  private cursorW: HTMLElement;
  private wipe: HTMLElement;
  private capIn: HTMLElement;
  private runNote: HTMLElement;
  private legend: HTMLElement;
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(root: HTMLElement) {
    this.root = root;
    root.className = 'merge';
    root.innerHTML =
      `<p class="lane-cap"><span class="cap-in">input</span>` +
      `<span class="run-note"></span></p>` +
      `<div class="lanes">` +
      `<div class="lane lane-src"><div class="seams"></div></div>` +
      `<div class="gap">` +
      `<svg class="chute" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">` +
      `<path pathLength="1" vector-effect="non-scaling-stroke"/></svg>` +
      `<i class="mcursor up cur-a" hidden></i>` +
      `<i class="mcursor up cur-b" hidden></i>` +
      `<i class="mcursor down cur-w" hidden></i>` +
      `</div>` +
      `<div class="lane lane-out"></div>` +
      `<div class="wipe"></div>` +
      `</div>` +
      `<p class="lane-cap legend"><span class="cap-out">output</span>` +
      `<span class="keys"><span class="sw sw-a"></span>left run` +
      `<span class="sw sw-b"></span>right run</span></p>`;
    this.srcLane = this.part('.lane-src');
    this.outLane = this.part('.lane-out');
    this.seams = this.part('.seams');
    this.cursorA = this.part('.cur-a');
    this.cursorB = this.part('.cur-b');
    this.cursorW = this.part('.cur-w');
    this.wipe = this.part('.wipe');
    this.capIn = this.part('.cap-in');
    this.runNote = this.part('.run-note');
    this.legend = this.part('.legend');
    const path = this.root.querySelector<SVGPathElement>('.chute path');
    if (path === null) throw new Error('missing chute path');
    this.chute = path;
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
      this.build(arrangeValues(size, order));
    }
    this.resetRun();
  }

  apply(raw: unknown): void {
    // Only steps from merge sort's buildSteps ever reach this view.
    const step = raw as MergeStep;
    this.dirty = true;
    switch (step.kind) {
      case 'init':
        this.signature = '';
        this.build(step.values);
        this.resetRun();
        break;
      case 'level':
        this.startLevel(step.width);
        break;
      case 'runs':
        this.startMerge(step.lo, step.mid, step.hi);
        break;
      // A lone tail run is the same picture with an empty right-hand side.
      case 'lone':
        this.startMerge(step.lo, step.hi, step.hi);
        break;
      case 'take':
      case 'copy':
        this.move(step.from, step.to, step.value, step.side, step.nextA, step.nextB);
        break;
      case 'sweep':
        this.sweep(step.values);
        break;
      case 'done':
        this.finish();
        break;
    }
  }

  /** Lanes, cursors, and seams are all placed in percentages of the lane. */
  relayout(): void {}

  destroy(): void {
    this.root.textContent = '';
    this.root.className = '';
    this.root.style.removeProperty('--n');
    this.srcCols = [];
    this.outCols = [];
  }

  private build(values: readonly number[]): void {
    this.n = values.length;
    this.root.style.setProperty('--n', String(this.n));
    this.srcCols = this.fill(this.srcLane, this.srcCols, this.n);
    this.outCols = this.fill(this.outLane, this.outCols, this.n);
    values.forEach((value, index) => {
      const column = this.srcCols[index];
      if (column === undefined) return;
      column.style.setProperty('--h', String(value));
      column.style.setProperty('--rise-delay', `${index * SETTLE_STAGGER_MS}ms`);
      if (!this.reduced.matches) column.classList.add('rising');
    });
    this.dirty = false;
  }

  /** Both lanes hold exactly n columns for the whole run; only classes change. */
  private fill(lane: HTMLElement, existing: HTMLElement[], count: number): HTMLElement[] {
    for (const column of existing) column.remove();
    const columns: HTMLElement[] = [];
    const frag = document.createDocumentFragment();
    for (let slot = 0; slot < count; slot++) {
      const column = document.createElement('div');
      column.className = 'mcol';
      column.style.left = `${this.slotPercent(slot)}%`;
      frag.appendChild(column);
      columns.push(column);
    }
    lane.appendChild(frag);
    return columns;
  }

  private resetRun(): void {
    // No merge is in flight, so there is no output to show: the input takes
    // the whole stage until a level opens the second lane.
    this.root.classList.add('solo');
    for (const column of this.srcCols) column.classList.remove('spent', 'run-a', 'run-b', 'sorted');
    for (const column of this.outCols) {
      column.className = 'mcol';
      column.style.removeProperty('--h');
    }
    this.seams.textContent = '';
    this.capIn.textContent = 'input';
    this.runNote.textContent = '';
    this.legend.classList.remove('on', 'done');
    this.cursorA.hidden = true;
    this.cursorB.hidden = true;
    this.cursorW.hidden = true;
    this.chute.classList.remove('on');
    this.wipe.classList.remove('on');
    this.hi = 0;
  }

  private slotPercent(slot: number): number {
    return this.n === 0 ? 0 : (slot / this.n) * 100;
  }

  /** Centre of a slot, for the marks that point at a column rather than fill it. */
  private centre(slot: number): number {
    return this.slotPercent(slot + 0.5);
  }

  private seatCursor(cursor: HTMLElement, slot: number | null): void {
    if (slot === null) {
      cursor.hidden = true;
      return;
    }
    cursor.style.left = `${this.centre(slot)}%`;
    cursor.hidden = false;
  }

  /** Redraws the seams for a level — one per boundary between runs. */
  private startLevel(width: number): void {
    this.root.classList.remove('solo');
    this.legend.classList.add('on');
    this.runNote.textContent = `runs of ${width} → ${Math.min(width * 2, this.n)}`;
    this.seams.textContent = '';
    const frag = document.createDocumentFragment();
    for (let edge = width; edge < this.n; edge += width) {
      const seam = document.createElement('i');
      seam.className = 'seam-mark';
      // Seams sit in the gutter between two columns, never on top of either.
      seam.style.left = `calc(${this.slotPercent(edge)}% - 2px)`;
      frag.appendChild(seam);
    }
    this.seams.appendChild(frag);
    for (const column of this.srcCols) column.classList.remove('spent', 'run-a', 'run-b');
  }

  /** Marks the pair about to merge and seats all three cursors. */
  private startMerge(lo: number, mid: number, hi: number): void {
    this.hi = hi;
    for (let slot = lo; slot < hi; slot++) {
      this.srcCols[slot]?.classList.add(slot < mid ? 'run-a' : 'run-b');
    }
    this.seatCursor(this.cursorA, lo < mid ? lo : null);
    this.seatCursor(this.cursorB, mid < hi ? mid : null);
    this.seatCursor(this.cursorW, lo < hi ? lo : null);
  }

  /** One value leaves the top lane and lands in the bottom one. */
  private move(
    from: number,
    to: number,
    value: number,
    side: Side,
    nextA: number | null,
    nextB: number | null,
  ): void {
    this.srcCols[from]?.classList.add('spent');
    const target = this.outCols[to];
    if (target !== undefined) {
      target.style.setProperty('--h', String(value));
      target.classList.remove('from-a', 'from-b', 'landing');
      // A forced reflow so a slot written on an earlier level drops again.
      void target.offsetWidth;
      target.classList.add('filled', side === 'a' ? 'from-a' : 'from-b');
      if (!this.reduced.matches) target.classList.add('landing');
    }
    this.drawChute(from, to);
    this.seatCursor(this.cursorA, nextA);
    this.seatCursor(this.cursorB, nextB);
    this.seatCursor(this.cursorW, to + 1 < this.hi ? to + 1 : null);
  }

  private drawChute(from: number, to: number): void {
    if (this.reduced.matches) return;
    this.chuteVariant = 1 - this.chuteVariant;
    this.chute.setAttribute('d', chutePath(this.centre(from), this.centre(to), this.chuteVariant));
    this.chute.classList.remove('on');
    void this.chute.getBoundingClientRect();
    this.chute.classList.add('on');
  }

  /** The output becomes the input: the values rise, the bottom lane empties. */
  private sweep(values: readonly number[]): void {
    values.forEach((value, index) => {
      const column = this.srcCols[index];
      if (column === undefined) return;
      column.classList.remove('spent', 'run-a', 'run-b', 'rising', 'settling');
      column.style.setProperty('--h', String(value));
    });
    for (const column of this.outCols) {
      column.className = 'mcol';
      column.style.removeProperty('--h');
    }
    this.cursorA.hidden = true;
    this.cursorB.hidden = true;
    this.cursorW.hidden = true;
    this.chute.classList.remove('on');
    this.wipe.classList.remove('on');
    this.hi = 0;
    if (this.reduced.matches) return;
    // One reflow for the whole lane, so a repeated settle actually replays.
    void this.srcLane.offsetWidth;
    for (const column of this.srcCols) column.classList.add('settling');
    this.wipe.classList.add('on');
  }

  private finish(): void {
    this.seams.textContent = '';
    // The lane stops being anything's input the moment the last merge lands.
    this.capIn.textContent = 'sorted';
    this.runNote.textContent = 'one run';
    this.wipe.classList.remove('on');
    // One run left and nothing to merge into: the output lane folds away and
    // the finished array takes back the whole stage.
    this.root.classList.add('solo');
    for (const column of this.srcCols) {
      column.classList.remove('spent', 'run-a', 'run-b');
      column.classList.add('sorted');
    }
    this.legend.classList.add('done');
  }
}
