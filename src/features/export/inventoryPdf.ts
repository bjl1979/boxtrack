import type { Box, Item, Move } from '../../db';
import { STATUS_META } from '../boxes/statusMeta';
import { flagText } from './rows';

/**
 * The built-in PDF fonts only cover Western European characters. Replace common symbols and drop
 * anything else (emoji, non-Latin scripts) so the PDF never shows garbage.
 */
export function pdfSafe(s: string): string {
  return s
    .replace(/[→⇒➔]/g, '->')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/×/g, 'x')
    .replace(/[^\x20-\x7E\xA0-\xFF\n–—•€…]/g, '')
    .trim();
}

function rooms(b: Box): string {
  if (b.fromRoom && b.toRoom) return b.fromRoom === b.toRoom ? b.toRoom : `${b.fromRoom} -> ${b.toRoom}`;
  return b.toRoom ? `-> ${b.toRoom}` : (b.fromRoom ?? '');
}

/** Inventory for movers or an insurance claim: one table row per box with its full item list. */
export async function buildInventoryPdf(move: Move, boxes: Box[], items: Item[], now = new Date()): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const byBox = new Map<string, Item[]>();
  for (const i of items) byBox.set(i.boxId, [...(byBox.get(i.boxId) ?? []), i]);
  const sorted = [...boxes].sort((a, b) => a.number - b.number);
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(pdfSafe(`Inventory – ${move.name}`), 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines = [
    [move.fromAddress && `From: ${move.fromAddress}`, move.toAddress && `To: ${move.toAddress}`].filter(Boolean).join('     '),
    `${sorted.length} boxes · ${itemCount} items · Printed ${now.toLocaleDateString(undefined, { dateStyle: 'long' })}`,
  ].filter(Boolean);
  lines.forEach((l, i) => doc.text(pdfSafe(l), 14, 25 + i * 5));

  autoTable(doc, {
    startY: 25 + lines.length * 5 + 2,
    head: [['Box', 'Label', 'Rooms', 'Flags', 'Status', 'Contents']],
    body: sorted.map((b) => {
      const its = (byBox.get(b.id) ?? []).sort((a, c) => a.position - c.position);
      const contents = its.map((i) => `${i.quantity > 1 ? `${i.quantity} x ` : ''}${i.name}${i.note ? ` (${i.note})` : ''}`).join('\n');
      const extra = [b.category, b.size && `Size ${b.size}`, b.weightKg !== undefined && `${b.weightKg} kg`].filter(Boolean).join(' · ');
      return [
        String(b.number),
        pdfSafe([b.label ?? '', extra].filter(Boolean).join('\n')),
        pdfSafe(rooms(b)),
        pdfSafe(flagText(b)),
        STATUS_META[b.status].label,
        pdfSafe([contents, b.notes && `Note: ${b.notes}`].filter(Boolean).join('\n')) || '—',
      ];
    }),
    styles: { fontSize: 9, cellPadding: 2, valign: 'top', overflow: 'linebreak' },
    headStyles: { fillColor: [234, 122, 47], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 12, fontStyle: 'bold', fontSize: 14, halign: 'center' },
      1: { cellWidth: 38 },
      2: { cellWidth: 30 },
      3: { cellWidth: 24 },
      4: { cellWidth: 20 },
      5: { cellWidth: 'auto' },
    },
    alternateRowStyles: { fillColor: [247, 247, 247] },
    margin: { left: 14, right: 14, bottom: 16 },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(pdfSafe(`BoxTrack · ${move.name} · page ${page}`), 14, doc.internal.pageSize.getHeight() - 8);
      doc.setTextColor(0);
    },
  });
  return doc.output('blob');
}
