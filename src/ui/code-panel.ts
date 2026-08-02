import Prism from 'prismjs';
import type { CodeListing, Step } from '../algorithms/types';

// The panel drives Prism itself; auto-highlight would wipe the line wrappers.
Prism.manual = true;

/** Prism-highlighted listing with a movable active-line marker. */
export class CodePanel {
  private lines: HTMLElement[] = [];
  private active: HTMLElement | null = null;
  private listing: CodeListing | null = null;

  constructor(
    private codeEl: HTMLElement,
    private labelEl: HTMLElement,
  ) {}

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
    this.codeEl.innerHTML = html
      .split('\n')
      .map((line) => `<span class="code-line">${line === '' ? ' ' : line}</span>`)
      .join('');
    this.lines = Array.from(this.codeEl.querySelectorAll('.code-line'));
    this.active = null;
  }

  apply(step: Step): void {
    if (this.listing === null) return;
    const line = this.listing.lineFor(step);
    if (line === null) return;
    this.setActiveLine(line);
  }

  setActiveLine(line: number | null): void {
    this.active?.classList.remove('active');
    this.active = line === null ? null : (this.lines[line - 1] ?? null);
    this.active?.classList.add('active');
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
