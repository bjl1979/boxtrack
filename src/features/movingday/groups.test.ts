import { NO_FLAGS, type Box } from '../../db';
import { deliveryGroups, unpackGroups } from './groups';

const box = (number: number, p: Partial<Box> = {}): Box => ({
  id: `b${number}`,
  moveId: 'm',
  number,
  flags: { ...NO_FLAGS },
  status: 'packing',
  createdAt: 0,
  updatedAt: 0,
  ...p,
});

describe('delivery groups', () => {
  it('splits boxes into on the way (missing), not shipped and arrived', () => {
    const g = deliveryGroups([
      box(3, { status: 'shipped' }),
      box(1, { status: 'shipped' }),
      box(2, { status: 'packed' }),
      box(4, { status: 'delivered', updatedAt: 10 }),
      box(5, { status: 'unpacked', updatedAt: 20 }),
      box(6),
    ]);
    expect(g.onTheWay.map((b) => b.number)).toEqual([1, 3]);
    expect(g.notShipped.map((b) => b.number)).toEqual([2, 6]);
    expect(g.arrived.map((b) => b.number)).toEqual([5, 4]); // latest first
    expect(g.total).toBe(6);
  });
});

describe('unpack groups', () => {
  it('lists delivered boxes with "open first" boxes first, then by room and number', () => {
    const flags = { ...NO_FLAGS, priority: true };
    const g = unpackGroups([
      box(1, { status: 'delivered', toRoom: 'Study' }),
      box(2, { status: 'delivered', toRoom: 'Kitchen' }),
      box(3, { status: 'delivered', toRoom: 'Study', flags }),
      box(4, { status: 'delivered' }),
      box(5, { status: 'unpacked', toRoom: 'Kitchen' }),
      box(6, { status: 'shipped' }),
    ]);
    expect(g.toUnpack.map((b) => b.number)).toEqual([3, 2, 1, 4]);
    expect(g.done.map((b) => b.number)).toEqual([5]);
  });
});
