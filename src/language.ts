/**
 * Which language the code panel shows. The choice is global, not per
 * algorithm: it says how the reader reads code, so it should survive picking a
 * different algorithm and a reload.
 *
 * Unlike the theme there is no inline boot script. `data-theme` paints the
 * whole page on the first frame, so it has to be resolved before paint; the
 * language only decides the contents of a panel that ships empty in the HTML
 * and is filled by the same module that resolves it.
 */

export type LanguageName = 'javascript' | 'python' | 'java';

const STORAGE_KEY = 'algo-lang';

/** Stored choice wins; JavaScript is the default listing everywhere. */
export function resolveLanguage(stored: string | null): LanguageName {
  return stored === 'python' || stored === 'java' ? stored : 'javascript';
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(language: LanguageName): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    /* storage unavailable — the choice just won't persist */
  }
}

/**
 * Wires the code panel's language switch and returns the language to start on.
 * `onChange` fires only for a user pick, so the caller re-renders the panel.
 */
export function initLanguage(onChange: (language: LanguageName) => void): LanguageName {
  const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="lang"]'));
  const language = resolveLanguage(readStored());
  for (const radio of radios) radio.checked = radio.value === language;

  for (const radio of radios) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const next = resolveLanguage(radio.value);
      store(next);
      onChange(next);
    });
  }

  return language;
}
