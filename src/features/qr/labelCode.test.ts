import { labelCode, parseLabel, parseRange } from './labelCode';

describe('label codes', () => {
  const moveId = '3f2c1a9e-1111-4222-8333-444455556666';

  it('round-trips the boxtrack:// format (written in capitals for a compact QR code)', () => {
    expect(labelCode(moveId, 12)).toBe(`BOXTRACK://MOVE/${moveId.toUpperCase()}/BOX/12`);
    expect(parseLabel(labelCode(moveId, 12))).toEqual({ moveId, number: 12 });
    // Lower-case labels (printed before this change) still scan.
    expect(parseLabel(`boxtrack://move/${moveId}/box/12`)).toEqual({ moveId, number: 12 });
  });

  it('labels use the compact QR alphanumeric mode', async () => {
    const QRCode = (await import('qrcode')).default;
    const size = (t: string) => QRCode.create(t, { errorCorrectionLevel: 'M' }).modules.size;
    expect(size(labelCode(moveId, 999))).toBeLessThan(size(`boxtrack://move/${moveId}/box/999`));
  });

  it('understands plain text labels', () => {
    expect(parseLabel('12')).toEqual({ number: 12 });
    expect(parseLabel(' Box 7 ')).toEqual({ number: 7 });
    expect(parseLabel('BOX #40')).toEqual({ number: 40 });
  });

  it('rejects anything else', () => {
    for (const bad of ['', 'hello', 'https://example.com', 'boxtrack://move//box/1', 'box 0', '1.5', `boxtrack://move/${moveId}/box/abc`]) {
      expect(parseLabel(bad)).toBeNull();
    }
  });

  it('parses print ranges', () => {
    expect(parseRange('1', '20')).toEqual({ from: 1, to: 20 });
    expect(parseRange('5', '5')).toEqual({ from: 5, to: 5 });
    expect(parseRange('20', '1')).toBeNull();
    expect(parseRange('1', '600')).toBeNull();
    expect(parseRange('', '3')).toBeNull();
  });
});
