import Prism from 'prismjs';
import type { CodeListing } from '../algorithms/types';
import { hangFor, indentOf, wrapPoints } from './wrap';

// The panel drives Prism itself; auto-highlight would wipe the line wrappers.
Prism.manual = true;

/** Prism-highlighted listing with a movable active-line marker. */
export class CodePanel {
  private lines: HTMLElement[] = [];
  private active: HTMLElement | null = null;
  private listing: CodeListing | null = null;
  /**
   * The step the marker is standing on. Re-rendering throws the line elements
   * away, so switching language mid-run has to ask the new listing where that
   * same step lives — otherwise the highlight goes dark until the next step.
   */
  private marker: unknown = null;
  /** Each line as plain text, and as the highlighted markup it started as. */
  private text: string[] = [];
  private markup: string[] = [];
  private hang = 4;
  /** How many characters fit on one row the last time the lines were laid out. */
  private cols = -1;

  constructor(
    private codeEl: HTMLElement,
    private labelEl: HTMLElement,
  ) {
    // A narrow panel wraps long lines, so a change of width means new breaks.
    // The work waits a frame: rewrapping changes the panel's height, and doing
    // that inside the observer's own callback trips its loop guard.
    const pre = codeEl.parentElement;
    if (pre !== null && typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => requestAnimationFrame(() => this.reflow())).observe(pre);
    }
    // The web font is a hair narrower than its fallback, so recount once it lands.
    void document.fonts?.ready.then(() => this.reflow());
  }

  show(listing: CodeListing): void {
    this.listing = listing;
    this.labelEl.textContent = listing.label;
    const grammar = Prism.languages[listing.language];
    const html =
      grammar === undefined
        ? escapeHtml(listing.code)
        : Prism.highlight(listing.code, grammar, listing.language);
    // Tokens in these listings never span lines, so the highlighted markup
    // can be split per line and each line wrapped for the marker. The wrappers
    // are blocks, so no newlines between them — inside a <pre> they'd render
    // as extra empty lines.
    this.text = listing.code.split('\n');
    this.markup = html.split('\n').map((line) => (line === '' ? ' ' : line));
    this.hang = hangFor(listing.code);
    // A wrapped row hangs under its own line: each line carries its indent,
    // and the listing carries how far past it to hang.
    this.codeEl.style.setProperty('--hang', String(this.hang));
    this.codeEl.innerHTML = this.markup
      .map(
        (line, index) =>
          `<span class="code-line" style="--indent: ${indentOf(this.text[index] ?? '')}">` +
          `${line}</span>`,
      )
      .join('');
    this.lines = Array.from(this.codeEl.querySelectorAll('.code-line'));
    this.active = null;
    this.cols = -1;
    this.reflow();
    if (this.marker !== null) this.setActiveLine(listing.lineFor(this.marker));
  }

  apply(step: unknown): void {
    if (this.listing === null) return;
    const line = this.listing.lineFor(step);
    if (line === null) return;
    this.marker = step;
    this.setActiveLine(line);
  }

  /** Back to no current line — a reset, or another algorithm taking over. */
  clear(): void {
    this.marker = null;
    this.setActiveLine(null);
  }

  private setActiveLine(line: number | null): void {
    this.active?.classList.remove('active');
    this.active = line === null ? null : (this.lines[line - 1] ?? null);
    this.active?.classList.add('active');
  }

  /**
   * Breaks every line that is too long for the panel into rows. The breaks
   * are chosen in wrap.ts and drawn by CSS, so the text itself never changes
   * and copying a wrapped line still gives back the line as written.
   */
  private reflow(): void {
    const cols = this.measureCols();
    if (cols === this.cols) return;
    this.cols = cols;
    this.lines.forEach((line, index) => {
      const points = wrapPoints(this.text[index] ?? '', cols, this.hang);
      if (points.length === 0 && !line.classList.contains('wrapped')) return;
      line.innerHTML = this.markup[index] ?? '';
      splitRows(line, points);
      line.classList.toggle('wrapped', points.length > 0);
    });
  }

  /** Characters that fit on one row, from the panel's width and the font's. */
  private measureCols(): number {
    const pre = this.codeEl.parentElement;
    const first = this.lines[0];
    if (pre === null || first === undefined) return Infinity;
    const style = getComputedStyle(first);
    const room =
      pre.clientWidth - parseFloat(style.borderLeftWidth) - 2 * parseFloat(style.paddingRight);
    const probe = document.createElement('span');
    probe.textContent = '0'.repeat(20);
    probe.style.cssText = 'position: absolute; visibility: hidden; white-space: pre';
    this.codeEl.appendChild(probe);
    const ch = probe.getBoundingClientRect().width / 20;
    probe.remove();
    return room > 0 && ch > 0 ? Math.floor(room / ch) : Infinity;
  }
}

/**
 * Moves everything from each break point onward into its own row. A row is an
 * inline span whose ::before is a line break, so the break is drawn, not typed.
 */
function splitRows(line: HTMLElement, points: readonly number[]): void {
  const rows: HTMLElement[] = [];
  for (const point of [...points].reverse()) {
    const [node, offset] = locate(line, point);
    const range = document.createRange();
    range.setStart(node, offset);
    range.setEnd(line, line.childNodes.length);
    const row = document.createElement('span');
    row.className = 'code-wrap';
    row.append(range.extractContents());
    rows.unshift(row);
  }
  line.append(...rows);
}

/** The text node and offset that sit `index` characters into `root`. */
function locate(root: Node, index: number): [Node, number] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = index;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (remaining < length) return [node, remaining];
    remaining -= length;
  }
  return [root, root.childNodes.length];
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
