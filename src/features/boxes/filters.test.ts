import { NO_FLAGS, type Box } from '../../db';
import { EMPTY_FILTERS, activeFilterCount, filterBoxes, sortBoxes, summarise } from './filters';

let n = 0;
const box = (p: Partial<Box>): Box => ({
  id: `b${++n}`,
  moveId: 'm',
  number: n,
  flags: { ...NO_FLAGS },
  status: 'packing',
  createdAt: 0,
  updatedAt: 0,
  ...p,
});

describe('filters', () => {
  const boxes = [
    box({ number: 3, status: 'packed', toRoom: 'Kitchen', category: 'Kitchen', flags: { ...NO_FLAGS, fragile: true }, updatedAt: 30 }),
    box({ number: 1, status: 'shipped', fromRoom: 'Study', toRoom: 'Study', category: 'Books', updatedAt: 10 }),
    box({ number: 2, status: 'delivered', fromRoom: 'Kitchen', flags: { ...NO_FLAGS, fragile: true, priority: true }, updatedAt: 20 }),
    box({ number: 4, status: 'unpacked', updatedAt: 5 }),
  ];

  it('no filters returns everything', () => {
    expect(filterBoxes(boxes, EMPTY_FILTERS)).toHaveLength(4);
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
  });

  it('filters by status (OR) and room matches from or to', () => {
    expect(filterBoxes(boxes, { ...EMPTY_FILTERS, statuses: ['packed', 'shipped'] }).map((b) => b.number)).toEqual([3, 1]);
    expect(filterBoxes(boxes, { ...EMPTY_FILTERS, rooms: ['Kitchen'] }).map((b) => b.number)).toEqual([3, 2]);
  });

  it('flags must all match; groups combine with AND', () => {
    expect(filterBoxes(boxes, { ...EMPTY_FILTERS, flags: ['fragile', 'priority'] }).map((b) => b.number)).toEqual([2]);
    const f = { ...EMPTY_FILTERS, rooms: ['Kitchen'], categories: ['Kitchen'] };
    expect(filterBoxes(boxes, f).map((b) => b.number)).toEqual([3]);
    expect(activeFilterCount(f)).toBe(2);
  });

  it('sorts by number or by last updated', () => {
    expect(sortBoxes(boxes, 'number').map((b) => b.number)).toEqual([1, 2, 3, 4]);
    expect(sortBoxes(boxes, 'updated').map((b) => b.number)).toEqual([3, 2, 1, 4]);
  });

  it('summarises statuses, with shipped counted as missing', () => {
    const s = summarise(boxes);
    expect(s).toMatchObject({ total: 4, packed: 4, delivered: 2, unpacked: 1, missing: 1 });
    expect(s.byStatus.packing).toBe(0);
  });
});
