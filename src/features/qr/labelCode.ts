/** What a box label's QR code contains, and how scanned text is understood. */

export interface LabelRef {
  /** Absent when the code only carries a box number. */
  moveId?: string;
  number: number;
}

export function labelCode(moveId: string, number: number): string {
  return `boxtrack://move/${moveId}/box/${number}`;
}

const validNumber = (n: number) => Number.isInteger(n) && n >= 1 && n <= 99999;

/**
 * Understands `boxtrack://move/{moveId}/box/{n}`, plain "BOX 12" / "Box #12", or just "12".
 * Returns null for anything else.
 */
export function parseLabel(text: string): LabelRef | null {
  const t = text.trim();
  const full = /^boxtrack:\/\/move\/([A-Za-z0-9-]{1,64})\/box\/(\d{1,5})\/?$/i.exec(t);
  if (full) {
    const number = Number(full[2]);
    return validNumber(number) ? { moveId: full[1], number } : null;
  }
  const plain = /^(?:box\s*#?\s*)?(\d{1,5})$/i.exec(t);
  if (plain) {
    const number = Number(plain[1]);
    return validNumber(number) ? { number } : null;
  }
  return null;
}

/** Parses "1-20", "1–20" or "5" into an inclusive range (max 500 labels). */
export function parseRange(from: string, to: string): { from: number; to: number } | null {
  const a = Number(from);
  const b = Number(to);
  if (!validNumber(a) || !validNumber(b) || b < a || b - a >= 500) return null;
  return { from: a, to: b };
}
