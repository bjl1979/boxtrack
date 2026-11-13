import { parseItemEntry } from '../../db';

export interface OcrLine {
  text: string;
  /** Tesseract confidence, 0–100. */
  confidence: number;
}

export const MIN_LINE_CONFIDENCE = 45;

const alnum = (s: string) => (s.match(/[\p{L}\p{N}]/gu) ?? []).length;

/**
 * Turns raw OCR lines into clean text: drops low-confidence lines and the noise you get from
 * photographing cardboard, tape and shadows (lines that are mostly symbols).
 */
export function cleanOcrLines(lines: OcrLine[]): string {
  const out: string[] = [];
  for (const l of lines) {
    const t = l.text.replace(/\s+/g, ' ').trim();
    if (!t || l.confidence < MIN_LINE_CONFIDENCE) continue;
    const letters = alnum(t);
    if (letters < 2 || letters / t.replace(/\s/g, '').length < 0.6) continue;
    out.push(t);
  }
  return out.join('\n');
}

function stripBullets(line: string): string {
  return line
    .replace(/^[\s\-–—•*·>»]+/, '') // bullets
    .replace(/^\(?\d{1,2}[.)]\s+/, '') // "1. " / "2) "
    .replace(/\s+/g, ' ')
    .trim();
}

/** SHOUTED LABEL TEXT → Title Case; mixed-case text is left alone. */
function titleIfShouted(t: string): string {
  if (t.length > 3 && t === t.toUpperCase() && /\p{L}/u.test(t)) {
    return t.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
  }
  return t;
}

export interface ItemCandidate {
  line: string;
  name: string;
  quantity: number;
}

/** Splits OCR text into item suggestions, one per line ("2x mugs" keeps its quantity). */
export function ocrTextToItemCandidates(text: string): ItemCandidate[] {
  const seen = new Set<string>();
  const out: ItemCandidate[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const tidy = stripBullets(raw);
    if (alnum(tidy) < 2) continue;
    const parsed = parseItemEntry(tidy);
    const name = titleIfShouted(parsed.name);
    const quantity = parsed.quantity;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ line: raw.trim(), name, quantity });
  }
  return out;
}
