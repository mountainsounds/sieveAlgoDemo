import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Every algorithm gets its own accent, and each new one has less room than the
 * last. These checks keep that from being decided by eye: the values below are
 * asserted to be the ones styles.css actually ships, and then measured.
 */
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

/** Panel colours are alpha-composited over the canvas, so blend them first. */
const rgb = (hex: string): [number, number, number] => {
  const s = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  return [r ?? 0, g ?? 0, b ?? 0];
};

const channel = (c: number): number => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const luminance = (hex: string): number => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

const over = (hex: string, alpha: number, backdrop: string): string => {
  const f = rgb(hex);
  const b = rgb(backdrop);
  return `#${f
    .map((c, i) => Math.round(c * alpha + (b[i] ?? 0) * (1 - alpha)))
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`;
};

/** sRGB → CIE Lab, for telling two inks apart by more than lightness alone. */
const lab = (hex: string): [number, number, number] => {
  const [r, g, b] = rgb(hex).map(channel);
  const x = (0.4124 * (r ?? 0) + 0.3576 * (g ?? 0) + 0.1805 * (b ?? 0)) / 0.95047;
  const y = 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
  const z = (0.0193 * (r ?? 0) + 0.1192 * (g ?? 0) + 0.9505 * (b ?? 0)) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};

const deltaE = (a: string, b: string): number => {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

const SIGNAL_CANVAS = '#0a0c10';
const NOTEBOOK_CANVAS = '#f7f3e9';
const SIGNAL_CODE = over('#0a0d12', 0.92, SIGNAL_CANVAS);
const NOTEBOOK_CODE = over('#fdfaf2', 0.92, NOTEBOOK_CANVAS);

interface Palette {
  theme: 'signal' | 'notebook';
  algo: string;
  accent: string;
  strong: string;
  accentContrast: string;
  keyword: string;
  /** Only set where the algorithm overrides the theme default. */
  fn?: string;
}

const THEME_FN = { signal: '#9db8ff', notebook: '#6d3fae' };

const PALETTES: Palette[] = [
  {
    theme: 'signal',
    algo: 'merge-sort',
    accent: '#b98cff',
    strong: '#d6bcff',
    accentContrast: '#1b0733',
    keyword: '#bf97ff',
    fn: '#5cb3f5',
  },
  {
    theme: 'notebook',
    algo: 'merge-sort',
    accent: '#6a2ec9',
    strong: '#54219f',
    accentContrast: '#faf7ff',
    keyword: '#6a2ec9',
    fn: '#2b4fa8',
  },
];

/** Accents already in use — a new one has to be a different colour, not a shade. */
const TAKEN = {
  signal: { sieve: '#3fe0ff', 'binary-search': '#46f0a0', 'insertion-sort': '#ff7ad9' },
  notebook: {
    sieve: '#2d55c8',
    'binary-search': '#1e7a4e',
    'insertion-sort': '#a3246f',
    pencil: '#d64a3b',
  },
};

describe.each(PALETTES)('$algo · $theme accent', (palette) => {
  const canvas = palette.theme === 'signal' ? SIGNAL_CANVAS : NOTEBOOK_CANVAS;
  const code = palette.theme === 'signal' ? SIGNAL_CODE : NOTEBOOK_CODE;

  it('is the block styles.css actually ships', () => {
    const block = css.match(
      new RegExp(
        `:root\\[data-theme='${palette.theme}'\\]\\[data-algo='${palette.algo}'\\]\\s*\\{([^}]*)\\}`,
      ),
    );
    expect(block, 'accent block is missing').not.toBeNull();
    const body = block?.[1] ?? '';
    expect(body).toContain(`--accent: ${palette.accent};`);
    expect(body).toContain(`--accent-strong: ${palette.strong};`);
    expect(body).toContain(`--accent-contrast: ${palette.accentContrast};`);
    expect(body).toContain(`--accent-rgb: ${rgb(palette.accent).join(', ')};`);
    expect(body).toContain(`--code-keyword: ${palette.keyword};`);
    if (palette.fn !== undefined) expect(body).toContain(`--code-function: ${palette.fn};`);
  });

  it('clears 4.5:1 everywhere text or a mark sits on it', () => {
    expect(contrast(palette.accent, canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.accent, code)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.accentContrast, palette.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.keyword, code)).toBeGreaterThanOrEqual(4.5);
    // --accent-strong only ever carries marks, so it holds the 3:1 bar.
    expect(contrast(palette.strong, canvas)).toBeGreaterThanOrEqual(3);
  });

  it('keeps keywords and function names apart in the code panel', () => {
    const fn = palette.fn ?? THEME_FN[palette.theme];
    expect(contrast(fn, code)).toBeGreaterThanOrEqual(4.5);
    // The bar is the pair the themes already ship at their default accent.
    const shipped = deltaE(
      palette.theme === 'signal' ? '#4bd7ff' : '#2d55c8',
      THEME_FN[palette.theme],
    );
    expect(deltaE(palette.keyword, fn)).toBeGreaterThanOrEqual(shipped);
  });

  it('is a different colour from every accent already in use', () => {
    for (const [algo, taken] of Object.entries(TAKEN[palette.theme])) {
      expect(deltaE(palette.accent, taken), `too close to ${algo}`).toBeGreaterThan(25);
    }
  });
});

/**
 * The code panel now carries Python and Java as well, which emit token types
 * JavaScript never did. They are all routed onto the three inks below, and
 * --code-keyword (plus --code-function, for merge sort) is re-keyed per
 * algorithm — so each ink has to be legible against all four accents, in both
 * themes, not just the one it was picked for.
 */
describe('code panel inks', () => {
  const ALGOS = ['sieve-of-eratosthenes', 'binary-search', 'insertion-sort', 'merge-sort'];
  const INKS = ['--code-keyword', '--code-function', '--code-number'];

  /** The block's declarations, or '' when the algorithm doesn't override. */
  const block = (theme: string, algo?: string): string => {
    const scope = algo === undefined ? '' : `\\[data-algo='${algo}'\\]`;
    const found = css.match(
      new RegExp(`:root\\[data-theme='${theme}'\\]${scope}\\s*\\{([^}]*)\\}`),
    );
    return found?.[1] ?? '';
  };

  /** What the panel actually paints: the algorithm's override, else the theme's. */
  const ink = (theme: string, algo: string, name: string): string => {
    const find = (body: string): string | undefined =>
      body.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
    const value = find(block(theme, algo)) ?? find(block(theme));
    if (value === undefined) throw new Error(`${theme}/${algo} has no ${name}`);
    return value;
  };

  for (const theme of ['signal', 'notebook'] as const) {
    const code = theme === 'signal' ? SIGNAL_CODE : NOTEBOOK_CODE;
    // The bar for telling two inks apart is the pair the theme itself ships.
    const spread = deltaE(
      ink(theme, 'sieve-of-eratosthenes', '--code-keyword'),
      ink(theme, 'sieve-of-eratosthenes', '--code-function'),
    );

    for (const algo of ALGOS) {
      it(`stay readable in ${theme} on ${algo}`, () => {
        for (const name of INKS) {
          const value = ink(theme, algo, name);
          expect(contrast(value, code), `${name} ${value} on ${theme}`).toBeGreaterThanOrEqual(4.5);
        }
        // Keywords and calls sit side by side on nearly every line, and
        // --code-function now carries Python's built-ins and Java's types too.
        expect(
          deltaE(ink(theme, algo, '--code-keyword'), ink(theme, algo, '--code-function')),
          `${theme}/${algo}: keyword and function ink are too close`,
        ).toBeGreaterThanOrEqual(spread);
      });
    }
  }
});
