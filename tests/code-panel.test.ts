import { readFileSync } from 'node:fs';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import { describe, expect, it } from 'vitest';
import {
  isChoice,
  type AlgorithmDef,
  type Control,
  type ControlValues,
} from '../src/algorithms/types';
import { registry } from '../src/registry';
import { resolveLanguage } from '../src/language';

/**
 * Three languages × five algorithms is fifteen step→line maps that have to stay
 * in sync with five step unions, and a wrong line number is invisible: the
 * panel happily lights up whatever line it is told to.
 *
 * So every step kind names the line it belongs on in each language, and also
 * says what that line has to *contain*. Insert a line into a listing and the
 * pinned number now points at the wrong text, which fails. The neighbour check
 * is what makes it specific: the anchor must not also match the line above or
 * below, so an off-by-one can't slide through on a loose pattern.
 */

const LANGUAGES = ['javascript', 'python', 'java'] as const;
type Language = (typeof LANGUAGES)[number];

/** Widest line the code panel shows at its default desktop width. */
const MAX_WIDTH = 58;

interface Anchor {
  /** Must match the mapped line, and neither line beside it. */
  at: RegExp;
  /** 1-based line, in LANGUAGES order. */
  lines: readonly [number, number, number];
}

const ANCHORS: Record<string, Record<string, Anchor>> = {
  'sieve-of-eratosthenes': {
    init: { at: /new Array\(n\)|\[True\] \* n|new boolean\[n\]/, lines: [2, 2, 2] },
    'strike-units': { at: /\[0\] =/, lines: [3, 3, 4] },
    'prime-found': { at: /if \(?is_?prime\[i\]\)?\s*[{:]$/i, lines: [6, 7, 7] },
    'composite-skip': { at: /if \(?is_?prime\[i\]\)?\s*[{:]$/i, lines: [6, 7, 7] },
    strike: { at: /\[j\] = false/i, lines: [8, 9, 9] },
    'sweep-done': { at: /count = 0/, lines: [13, 12, 14] },
    // Python puts the tally on its own line, so only a prime gets that far.
    'count-visit:prime': { at: /count(\+\+|\s\+= 1)/, lines: [15, 15, 16] },
    'count-visit:composite': { at: /if \(?is_?prime\[i\]\)?/i, lines: [15, 14, 16] },
    done: { at: /return count/, lines: [17, 16, 18] },
  },
  'binary-search': {
    init: { at: /lo = 0/, lines: [2, 2, 2] },
    'level-set': { at: /hi = (a\.length|len\(a\)) - 1/, lines: [3, 3, 3] },
    probe: { at: /mid = /, lines: [6, 6, 6] },
    compare: { at: /a\[mid\] ==/, lines: [8, 8, 8] },
    'discard:left': { at: /lo = mid \+ 1/, lines: [12, 11, 12] },
    'discard:right': { at: /hi = mid - 1/, lines: [14, 13, 14] },
    found: { at: /return mid/, lines: [9, 9, 9] },
    'not-found': { at: /return -1/, lines: [18, 15, 18] },
  },
  'insertion-sort': {
    init: { at: /^(function|def|static) /, lines: [1, 1, 1] },
    seed: { at: /i = 1; i <|for i in range\(1/, lines: [2, 2, 2] },
    pick: { at: /key = a\[i\]/, lines: [3, 3, 3] },
    compare: { at: /while .*a\[j\] > key/, lines: [6, 6, 6] },
    wall: { at: /while .*a\[j\] > key/, lines: [6, 6, 6] },
    shift: { at: /a\[j \+ 1\] = a\[j\]/, lines: [7, 7, 7] },
    place: { at: /a\[j \+ 1\] = key/, lines: [11, 10, 11] },
    done: { at: /return a;?$/, lines: [13, 11, 13] },
  },
  'merge-sort': {
    init: { at: /out = (a\.slice\(\)|a\[:\]|new int\[n\])/, lines: [2, 2, 3] },
    level: { at: /w = 1; w <|while w < /, lines: [3, 4, 4] },
    runs: { at: /lo = 0; lo <|for lo in range/, lines: [4, 5, 5] },
    lone: { at: /lo = 0; lo <|for lo in range/, lines: [4, 5, 5] },
    'take:a': { at: /out\[k\] = a\[i/, lines: [11, 12, 12] },
    'take:b': { at: /out\[k\] = a\[j/, lines: [12, 15, 14] },
    'copy:a': { at: /out\[k\] = a\[i/, lines: [11, 12, 12] },
    'copy:b': { at: /out\[k\] = a\[j/, lines: [12, 15, 14] },
    sweep: { at: /a = out/, lines: [15, 17, 18] },
    done: { at: /return a;?$/, lines: [17, 19, 20] },
  },
  'quick-sort': {
    init: { at: /^(function|def|static) /, lines: [1, 1, 1] },
    'call:root': { at: /^(function|def|static) /, lines: [1, 1, 1] },
    'call:left': { at: /quick_?sort\(a, lo, i - 1\)/i, lines: [16, 15, 20] },
    'call:right': { at: /quick_?sort\(a, i \+ 1, hi\)/i, lines: [17, 16, 21] },
    'guard:plain': { at: /if \(?lo >= hi\)?/, lines: [2, 2, 2] },
    // Python is the one listing that splits the test from the return, so a
    // range that stops here lands a line below the one that carries on.
    'guard:trivial': { at: /return a;?$/, lines: [2, 3, 2] },
    pivot: { at: /pivot = a\[hi\]/, lines: [4, 5, 4] },
    scan: { at: /if \(?a\[j\] < pivot\)?/, lines: [8, 9, 8] },
    // Three ways to swap two slots. Java spends three lines on it, so the one
    // that gets the highlight is the write to a[i] — the same moment the other
    // two do in one line.
    swap: { at: /a\[i\].*a\[j\]/, lines: [9, 10, 10] },
    settle: { at: /a\[i\].*a\[hi\]/, lines: [14, 13, 17] },
    done: { at: /return a;?$/, lines: [18, 17, 22] },
  },
};

/** Step kinds whose line depends on the step's own payload, not just its kind. */
function variantOf(algo: string, step: unknown): string {
  const s = step as { kind: string; side?: string; prime?: boolean; trivial?: boolean };
  if (algo === 'binary-search' && s.kind === 'discard') return `discard:${s.side}`;
  if (algo === 'merge-sort' && (s.kind === 'take' || s.kind === 'copy'))
    return `${s.kind}:${s.side}`;
  if (algo === 'sieve-of-eratosthenes' && s.kind === 'count-visit')
    return `count-visit:${s.prime === true ? 'prime' : 'composite'}`;
  if (algo === 'quick-sort' && s.kind === 'call') return `call:${s.side}`;
  if (algo === 'quick-sort' && s.kind === 'guard')
    return `guard:${s.trivial === true ? 'trivial' : 'plain'}`;
  return s.kind;
}

/** Every value a control can take; the ranges here are small enough to walk. */
function valuesFor(control: Control): number[] {
  if (isChoice(control)) return control.options.map((option) => option.value);
  const span = control.max - control.min;
  if (span <= 128) return Array.from({ length: span + 1 }, (_, k) => control.min + k);
  return [control.min, control.default, Math.round((control.min + control.max) / 2), control.max];
}

/** Cross product of every control's values. */
function sweep(def: AlgorithmDef): ControlValues[] {
  let combos: Record<string, number>[] = [{}];
  for (const control of def.controls) {
    combos = combos.flatMap((base) =>
      valuesFor(control).map((value) => ({ ...base, [control.id]: value })),
    );
  }
  return combos;
}

function listingFor(
  def: AlgorithmDef,
  language: Language,
): {
  language: string;
  label: string;
  code: string;
  lineFor(step: unknown): number | null;
} {
  const listing = def.listings.find((candidate) => candidate.language === language);
  if (listing === undefined) throw new Error(`${def.id} has no ${language} listing`);
  return listing;
}

const defs = registry.map((entry) => entry.def);

describe.each(defs.map((def) => ({ id: def.id, def })))('$id listings', ({ def }) => {
  it('ships one listing per language, in switcher order', () => {
    expect(def.listings.map((listing) => listing.language)).toEqual([...LANGUAGES]);
  });

  it('labels each listing the way that language names files', () => {
    const stem = def.listings[0]?.label.replace(/\.js$/, '') ?? '';
    const [js, python, java] = def.listings;
    expect(js?.label).toMatch(/^[a-z][A-Za-z]+\.js$/);
    // camelCase → snake_case → PascalCase, same name underneath.
    expect(python?.label).toBe(`${stem.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}.py`);
    expect(java?.label).toBe(`${stem.charAt(0).toUpperCase()}${stem.slice(1)}.java`);
  });

  it.each([...LANGUAGES])('keeps every %s line inside the panel', (language) => {
    const listing = listingFor(def, language);
    for (const [index, line] of listing.code.split('\n').entries()) {
      expect(line.length, `${listing.label}:${index + 1} «${line}»`).toBeLessThanOrEqual(MAX_WIDTH);
      expect(line, `${listing.label}:${index + 1}`).not.toMatch(/\t|\s$|\r/);
    }
  });

  it('maps every step it can emit, in every language', () => {
    const anchors = ANCHORS[def.id] ?? {};
    const seen = new Set<string>();
    for (const values of sweep(def)) {
      for (const step of def.buildSteps(values)) {
        const variant = variantOf(def.id, step);
        seen.add(variant);
        const anchor = anchors[variant];
        expect(anchor, `${def.id}: no anchor declared for ${variant}`).toBeDefined();
        if (anchor === undefined) continue;
        LANGUAGES.forEach((language, index) => {
          expect(listingFor(def, language).lineFor(step), `${def.id} ${language} ${variant}`).toBe(
            anchor.lines[index],
          );
        });
      }
    }
    // Anything the table declares but no run produces is a stale entry.
    expect([...seen].sort()).toEqual(Object.keys(anchors).sort());
  });

  it.each([...LANGUAGES])('points each %s line at the code it claims', (language) => {
    const listing = listingFor(def, language);
    const lines = listing.code.split('\n');
    const index = LANGUAGES.indexOf(language);
    for (const [variant, anchor] of Object.entries(ANCHORS[def.id] ?? {})) {
      const line = anchor.lines[index] ?? 0;
      const where = `${listing.label} ${variant} line ${line}`;
      expect(line, where).toBeGreaterThan(0);
      expect(line, where).toBeLessThanOrEqual(lines.length);
      expect(lines[line - 1] ?? '', where).toMatch(anchor.at);
      // A pattern loose enough to match a neighbour can't prove the line.
      expect(lines[line - 2] ?? '', `${where}: also matches the line above`).not.toMatch(anchor.at);
      expect(lines[line] ?? '', `${where}: also matches the line below`).not.toMatch(anchor.at);
    }
  });
});

describe('resolveLanguage', () => {
  it('honors a stored choice', () => {
    expect(resolveLanguage('python')).toBe('python');
    expect(resolveLanguage('java')).toBe('java');
    expect(resolveLanguage('javascript')).toBe('javascript');
  });

  it('falls back to JavaScript when nothing usable is stored', () => {
    expect(resolveLanguage(null)).toBe('javascript');
    expect(resolveLanguage('')).toBe('javascript');
    expect(resolveLanguage('typescript')).toBe('javascript');
  });

  it('only offers languages every algorithm actually ships', () => {
    for (const language of LANGUAGES) {
      expect(resolveLanguage(language)).toBe(language);
      for (const def of defs) {
        expect(
          def.listings.some((listing) => listing.language === language),
          `${def.id} is missing ${language}`,
        ).toBe(true);
      }
    }
  });
});

describe('syntax highlighting', () => {
  /**
   * CodePanel falls back to plain escaped text when Prism has no grammar for a
   * language — no error, just an unhighlighted listing. main.ts is where the
   * grammars are pulled in, so that is what gets checked.
   */
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

  it.each([...LANGUAGES])('imports the %s grammar in main.ts', (language) => {
    expect(main).toContain(`prismjs/components/prism-${language}`);
    expect(Prism.languages[language]).toBeDefined();
  });

  it('tokenizes every listing rather than falling back to plain text', () => {
    for (const def of defs) {
      for (const listing of def.listings) {
        const grammar = Prism.languages[listing.language];
        expect(grammar, listing.label).toBeDefined();
        if (grammar === undefined) continue;
        const html = Prism.highlight(listing.code, grammar, listing.language);
        expect(html, listing.label).toContain('class="token keyword"');
      }
    }
  });

  /**
   * Python and Java emit token types JavaScript never did. An unstyled one
   * inherits --text and reads as an ordinary identifier, which is a decision,
   * not an accident — so it has to be made here.
   */
  it('styles every token type the listings emit, or says why not', () => {
    const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    const styled = new Set([...css.matchAll(/\.token\.([\w-]+)/g)].map((m) => m[1] ?? ''));
    // Parameters read as plain text on purpose: `a` and `n` are plain
    // everywhere else in the listing, so the signature should match.
    const plainByDesign = new Set(['parameter']);

    const emitted = new Set<string>();
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        for (const child of node) walk(child);
        return;
      }
      if (node === null || typeof node !== 'object' || !('type' in node)) return;
      const token = node as { type: string; alias?: string | string[]; content: unknown };
      const alias = typeof token.alias === 'string' ? [token.alias] : (token.alias ?? []);
      for (const name of [token.type, ...alias]) emitted.add(name);
      walk(token.content);
    };

    for (const def of defs) {
      for (const listing of def.listings) {
        const grammar = Prism.languages[listing.language];
        if (grammar !== undefined) walk(Prism.tokenize(listing.code, grammar));
      }
    }

    expect(emitted.size).toBeGreaterThan(0);
    for (const type of [...emitted].sort()) {
      expect(styled.has(type) || plainByDesign.has(type), `.token.${type} is unstyled`).toBe(true);
    }
  });
});
