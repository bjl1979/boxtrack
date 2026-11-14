import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** QR code as crisp inline SVG (prints sharply at any size). */
export function QrSvg({ text, className }: { text: string; className?: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''));
    return () => {
      alive = false;
    };
  }, [text]);
  // The SVG markup is generated locally by the qrcode library from our own label text.
  return <div className={className} data-qr={text} role="img" aria-label="QR code" dangerouslySetInnerHTML={{ __html: svg }} />;
}
