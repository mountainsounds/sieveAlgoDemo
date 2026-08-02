import type { AlgorithmView, ControlValues } from '../../algorithms/types';
import { sortedValues, SIZE, TARGET, type SearchStep } from '../../algorithms/binary-search';

/**
 * Renders binary search as a strip of sorted bars under a horizontal target
 * line: the value each probe is compared against, drawn at the target's
 * height. Probing mid glides a caret and a value tag to the bar; discarding
 * half the window powers those bars down in a cascade away from mid while a
 * bracket under the baseline shrinks onto what's left.
 *
 * Signal draws the line as a glowing trigger level; Notebook rules it in red
 * pencil and scratches discarded bars out by hand. As in the sieve view, both
 * sets of SVG marks exist in both themes — the theme that doesn't use them
 * hides them with `visibility`, so switching mid-run never replays draws.
 */

/* Quick diagonal slashes, alternating direction — the pencil voids a column
   the way the sieve strikes a tile. */
const SCRATCHES = [
  'M3 7 C 8 31, 11 58, 17 94',
  'M17 5 C 13 33, 8 63, 3 95',
  'M2 9 C 9 30, 10 62, 18 96',
];

const RINGS = [
  'M50 15 C 71 13, 86 27, 86 48 C 86 71, 69 86, 47 85 C 26 84, 13 68, 14 46 C 15 27, 31 16, 53 15 C 60 15, 66 17, 71 21',
  'M46 14 C 68 11, 87 25, 87 47 C 87 70, 71 87, 48 86 C 25 85, 12 69, 13 46 C 14 25, 29 15, 50 14 C 58 14, 64 15, 69 18',
];

/** Hand-drawn dashed rule for the Notebook target line; wobbles a little. */
const LEVEL_PATH = 'M0 4.2 C 160 2.6, 340 5.4, 560 3.4 C 720 2.2, 880 4.8, 1000 3.6';

const CARET_PATH = 'M3 12 C 7 6.5, 10 3.8, 12 3 C 14.5 4.4, 18 8, 21 12';

const STAGGER_MS = 26;

function barMarkup(index: number): string {
  const scratch = SCRATCHES[index % SCRATCHES.length];
  const ring = RINGS[index % RINGS.length];
  return (
    `<svg class="bar-scratch" viewBox="0 0 20 100" preserveAspectRatio="none" aria-hidden="true">` +
    `<path d="${scratch}" pathLength="1" vector-effect="non-scaling-stroke"/></svg>` +
    `<svg class="bar-ring" viewBox="0 0 100 100" aria-hidden="true">` +
    `<path d="${ring}" pathLength="1" vector-effect="non-scaling-stroke"/></svg>`
  );
}

export class SearchView implements AlgorithmView {
  private bars: HTMLElement[] = [];
  private values: readonly number[] = [];
  private plot: HTMLElement;
  private level: HTMLElement;
  private levelTag: HTMLElement;
  private tag: HTMLElement;
  private caret: HTMLElement;
  private win: HTMLElement;
  private winLo: HTMLElement;
  private winHi: HTMLElement;
  private rangeNote: HTMLElement;
  private lastProbe: HTMLElement | null = null;
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private root: HTMLElement) {
    root.className = 'search';
    root.innerHTML =
      `<div class="chart"><div class="plot">` +
      `<div class="level">` +
      `<svg class="level-pencil" viewBox="0 0 1000 8" preserveAspectRatio="none" aria-hidden="true">` +
      `<path d="${LEVEL_PATH}" vector-effect="non-scaling-stroke"/></svg>` +
      `<span class="level-tag"></span>` +
      `</div>` +
      `<div class="probe-tag" hidden></div>` +
      `<div class="probe-caret" hidden>` +
      `<svg viewBox="0 0 24 14" aria-hidden="true"><path d="${CARET_PATH}"/></svg>` +
      `</div>` +
      `<span class="range-note"></span>` +
      `</div></div>` +
      `<div class="rail">` +
      `<div class="win"><span class="win-lo"></span><span class="win-hi"></span></div>` +
      `</div>`;
    this.plot = this.part('.plot');
    this.level = this.part('.level');
    this.levelTag = this.part('.level-tag');
    this.tag = this.part('.probe-tag');
    this.caret = this.part('.probe-caret');
    this.win = this.part('.win');
    this.winLo = this.part('.win-lo');
    this.winHi = this.part('.win-hi');
    this.rangeNote = this.part('.range-note');
  }

  private part(selector: string): HTMLElement {
    const node = this.root.querySelector<HTMLElement>(selector);
    if (node === null) throw new Error(`missing ${selector}`);
    return node;
  }

  preview(values: ControlValues): void {
    const size = values['size'] ?? SIZE.default;
    if (size !== this.values.length) this.buildStrip(sortedValues(size));
    this.resetRun();
    this.setLevel(values['target'] ?? TARGET.min);
    this.level.classList.add('on');
  }

  apply(raw: unknown): void {
    // Only steps from binary search's buildSteps ever reach this view.
    const step = raw as SearchStep;
    switch (step.kind) {
      case 'init':
        this.buildStrip(step.values);
        this.resetRun();
        this.setLevel(step.target);
        this.level.classList.remove('on');
        break;
      case 'level-set':
        this.level.classList.add('on');
        break;
      case 'probe':
        this.markProbe(step.mid);
        break;
      case 'compare':
        this.tag.textContent = `a[${step.mid}] = ${step.value}`;
        break;
      case 'discard':
        this.discard(step.side, step.from, step.to);
        this.setWindow(step.lo, step.hi);
        break;
      case 'found':
        this.bars[step.index]?.classList.add('found');
        this.tag.classList.add('hit');
        break;
      case 'not-found':
        this.level.classList.add('miss');
        break;
    }
  }

  /** All markers are positioned in percentages, so a resize needs no work. */
  relayout(): void {}

  destroy(): void {
    this.root.textContent = '';
    this.root.className = '';
    this.bars = [];
    this.values = [];
    this.lastProbe = null;
  }

  private buildStrip(values: readonly number[]): void {
    for (const bar of this.bars) bar.remove();
    this.bars = [];
    this.values = values;
    const frag = document.createDocumentFragment();
    const skipRise = this.reduced.matches;
    values.forEach((value, index) => {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.setProperty('--h', String(value));
      if (!skipRise) bar.style.setProperty('--rise-delay', `${index * 12}ms`);
      bar.innerHTML = barMarkup(index);
      frag.appendChild(bar);
      this.bars.push(bar);
    });
    this.plot.insertBefore(frag, this.level);
    const first = values[0];
    const last = values[values.length - 1];
    this.rangeNote.textContent =
      first === undefined || last === undefined ? '' : `values ${first}–${last}`;
  }

  private resetRun(): void {
    for (const bar of this.bars) {
      bar.classList.remove('dead', 'probe', 'found');
      bar.style.removeProperty('--die-delay');
    }
    this.lastProbe = null;
    this.tag.hidden = true;
    this.tag.classList.remove('hit');
    this.caret.hidden = true;
    this.level.classList.remove('miss');
    this.setWindow(0, this.values.length - 1);
  }

  private setLevel(target: number): void {
    this.level.style.setProperty('--ty', String(target));
    this.levelTag.textContent = String(target);
    this.level.classList.remove('miss');
  }

  private markProbe(mid: number): void {
    const bar = this.bars[mid];
    if (bar === undefined) return;
    this.lastProbe?.classList.remove('probe');
    bar.classList.add('probe');
    this.lastProbe = bar;
    const x = `${((mid + 0.5) / this.values.length) * 100}%`;
    this.tag.style.setProperty('--x', x);
    this.tag.style.setProperty('--th', String(this.values[mid] ?? 0));
    this.tag.textContent = `a[${mid}]`;
    this.tag.hidden = false;
    this.caret.style.setProperty('--x', x);
    this.caret.hidden = false;
  }

  private discard(side: 'left' | 'right', from: number, to: number): void {
    // The probed bar sits at the window edge being cut; cascade away from it.
    const origin = side === 'left' ? to : from;
    const stagger = this.reduced.matches ? 0 : STAGGER_MS;
    for (let i = from; i <= to; i++) {
      const bar = this.bars[i];
      if (bar === undefined || bar.classList.contains('dead')) continue;
      bar.style.setProperty('--die-delay', `${Math.abs(i - origin) * stagger}ms`);
      bar.classList.add('dead');
    }
  }

  private setWindow(lo: number, hi: number): void {
    if (hi < lo || this.values.length === 0) {
      this.win.hidden = true;
      return;
    }
    const n = this.values.length;
    this.win.hidden = false;
    this.win.style.left = `${(lo / n) * 100}%`;
    this.win.style.width = `${((hi - lo + 1) / n) * 100}%`;
    this.win.classList.toggle('tight', (hi - lo + 1) / n < 0.16);
    this.winLo.textContent = String(lo);
    this.winHi.textContent = String(hi);
  }
}
