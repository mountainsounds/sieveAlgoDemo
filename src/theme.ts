export type ThemeName = 'signal' | 'notebook';

const STORAGE_KEY = 'algo-theme';

const THEME_COLOR: Record<ThemeName, string> = {
  signal: '#0a0c10',
  notebook: '#f7f3e9',
};

/** Stored choice wins; otherwise the OS preference decides. */
export function resolveTheme(stored: string | null, prefersLight: boolean): ThemeName {
  if (stored === 'signal' || stored === 'notebook') return stored;
  return prefersLight ? 'notebook' : 'signal';
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(theme: ThemeName): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage unavailable — the choice just won't persist */
  }
}

/**
 * Wires the header switcher. The inline boot script has already set
 * data-theme; this keeps the radios, meta theme-color, and OS-preference
 * listener in sync from then on.
 */
export function initTheme(): void {
  const media = window.matchMedia('(prefers-color-scheme: light)');
  const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="theme"]'));
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

  const apply = (theme: ThemeName): void => {
    document.documentElement.dataset.theme = theme;
    meta?.setAttribute('content', THEME_COLOR[theme]);
    for (const radio of radios) radio.checked = radio.value === theme;
  };

  apply(resolveTheme(readStored(), media.matches));

  // Follow OS changes only while the user hasn't picked explicitly.
  media.addEventListener('change', (event) => {
    if (readStored() === null) apply(resolveTheme(null, event.matches));
  });

  for (const radio of radios) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const theme = radio.value === 'notebook' ? 'notebook' : 'signal';
      store(theme);
      apply(theme);
    });
  }
}
