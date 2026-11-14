import type { AppSettings } from '../db';

type Theme = AppSettings['theme'];
const KEY = 'bt.theme';
const COLORS = { dark: '#161618', light: '#f4f2ef' };

function resolved(theme: Theme): 'dark' | 'light' {
  if (theme !== 'system') return theme;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Applies the theme to <html> and the browser bar colour, and remembers it for the next start. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[resolved(theme)]);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked – the theme is still stored in the database */
  }
}

/** Called before the first render so the app never flashes the wrong theme. */
export function applyStoredTheme(): void {
  let theme: Theme = 'system';
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'light' || t === 'dark' || t === 'system') theme = t;
  } catch {
    /* ignore */
  }
  applyTheme(theme);
  window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (document.documentElement.dataset.theme === 'system') applyTheme('system');
  });
}
