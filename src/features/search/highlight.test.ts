import { highlight, snippet } from './highlight';

const show = (segs: { text: string; hit: boolean }[]) => segs.map((s) => (s.hit ? `[${s.text}]` : s.text)).join('');

describe('highlight', () => {
  it('marks whole words that start with a matched term, case-insensitively', () => {
    expect(show(highlight('Passport and passports', ['passport']))).toBe('[Passport] and [passports]');
    expect(show(highlight('Garam Masala jar', ['masala', 'jar']))).toBe('Garam [Masala] [jar]');
  });
  it('does not match inside words', () => {
    expect(show(highlight('impassport', ['passport']))).toBe('impassport');
  });
  it('escapes regex characters and handles no terms', () => {
    expect(show(highlight('a+b (c)', ['a+b']))).toBe('[a+b] (c)');
    expect(show(highlight('abc', []))).toBe('abc');
  });
});

describe('snippet', () => {
  it('keeps short text as is and windows long text around the first hit', () => {
    expect(show(snippet(highlight('short text', ['text'])))).toBe('short [text]');
    const long = `${'x '.repeat(60)}MASALA ${'y '.repeat(60)}`;
    const s = show(snippet(highlight(long, ['masala']), 40));
    expect(s).toContain('[MASALA]');
    expect(s.startsWith('…')).toBe(true);
    expect(s.endsWith('…')).toBe(true);
  });
});
