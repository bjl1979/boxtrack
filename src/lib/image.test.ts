import { fitWithin } from './image';

describe('fitWithin', () => {
  it('scales the longest side down to the limit', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 300)).toEqual({ width: 225, height: 300 });
  });
  it('never scales up', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
  it('rejects empty images', () => {
    expect(() => fitWithin(0, 10, 100)).toThrow();
  });
});
