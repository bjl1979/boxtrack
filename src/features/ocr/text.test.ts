import { cleanOcrLines, ocrTextToItemCandidates } from './text';

describe('cleanOcrLines', () => {
  it('keeps confident text lines and drops noise', () => {
    expect(
      cleanOcrLines([
        { text: '  EVEREST  ', confidence: 91 },
        { text: 'Garam   Masala', confidence: 88 },
        { text: '|||| ~~ //', confidence: 70 },
        { text: 'blurry words', confidence: 20 },
        { text: 'a', confidence: 99 },
        { text: 'Net wt 100 g', confidence: 77 },
      ]),
    ).toBe('EVEREST\nGaram Masala\nNet wt 100 g');
  });
});

describe('ocrTextToItemCandidates', () => {
  it('turns lines into items, tidying bullets, capitals, quantities and duplicates', () => {
    expect(ocrTextToItemCandidates('GARAM MASALA\n- 2x Coffee mugs\n1. Tea towels\n\n~\ngaram masala\nUSB-C cable\n2x TEA TINS')).toEqual([
      { line: 'GARAM MASALA', name: 'Garam Masala', quantity: 1 },
      { line: '- 2x Coffee mugs', name: 'Coffee mugs', quantity: 2 },
      { line: '1. Tea towels', name: 'Tea towels', quantity: 1 },
      { line: 'USB-C cable', name: 'USB-C cable', quantity: 1 },
      { line: '2x TEA TINS', name: 'Tea Tins', quantity: 2 },
    ]);
  });
});
