export interface Segment {
  text: string;
  hit: boolean;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Splits text into plain and highlighted parts. `terms` are the index terms that matched
 * (lower-case words); a word is highlighted when it starts with one of them.
 */
export function highlight(text: string, terms: string[]): Segment[] {
  const clean = [...new Set(terms.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (!clean.length) return [{ text, hit: false }];
  clean.sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${clean.map(escape).join('|')})[\\p{L}\\p{N}]*`, 'giu');
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), hit: false });
    out.push({ text: m[0], hit: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out.length ? out : [{ text, hit: false }];
}

/** Shortens long text (e.g. OCR output) to a window around the first highlighted word. */
export function snippet(segments: Segment[], max = 80): Segment[] {
  const total = segments.reduce((n, s) => n + s.text.length, 0);
  if (total <= max) return segments;
  let pos = 0;
  let firstHit = 0;
  for (const s of segments) {
    if (s.hit) {
      firstHit = pos;
      break;
    }
    pos += s.text.length;
  }
  const start = Math.max(0, Math.min(firstHit - 25, total - max));
  const end = start + max;
  const out: Segment[] = [];
  pos = 0;
  for (const s of segments) {
    const a = Math.max(start, pos);
    const b = Math.min(end, pos + s.text.length);
    if (a < b) out.push({ text: s.text.slice(a - pos, b - pos), hit: s.hit });
    pos += s.text.length;
  }
  if (start > 0) out.unshift({ text: '…', hit: false });
  if (end < total) out.push({ text: '…', hit: false });
  return out;
}
