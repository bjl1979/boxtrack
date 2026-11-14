import { useEffect, useMemo, useRef, useState } from 'react';
import { useBoxes, type Box, type Move } from '../../db';
import { PageHeader } from '../../components/AppShell';
import { Button, Segmented, cx } from '../../components/ui';
import { IconPrinter } from '../../components/Icons';
import { inputClass } from '../moves/MoveForm';
import { labelCode, parseRange } from './labelCode';
import { QrSvg } from './QrSvg';
import './labels.css';

type PerPage = '8' | '4';
const SHEET_PX = 793.7; // 210 mm at 96 dpi

interface LabelData {
  number: number;
  box?: Box;
}

function Label({ move, data }: { move: Move; data: LabelData }) {
  const b = data.box;
  const flags = [
    b?.flags.fragile && '🍷 FRAGILE',
    b?.flags.priority && '⭐ OPEN FIRST',
    b?.flags.thisSideUp && '⬆ THIS SIDE UP',
    b?.flags.valuable && '💎 VALUABLE',
  ].filter(Boolean) as string[];
  return (
    <div className="label" data-testid="label" data-number={data.number}>
      <div className="label-top">
        <div className="label-number">{data.number}</div>
        <QrSvg className="label-qr" text={labelCode(move.id, data.number)} />
      </div>
      <div className="label-to">{b?.toRoom ? `To: ${b.toRoom}` : 'To: ____________'}</div>
      <div className="label-text">{b?.label ?? ''}</div>
      {flags.length > 0 && (
        <div className="label-flags">
          {flags.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
      )}
      <div className="label-move">{move.name}</div>
    </div>
  );
}

/** Scales the real-size A4 sheets down to fit the phone screen in the preview. */
function useFitScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.45);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / SHEET_PX)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, scale] as const;
}

export function LabelsPage({ move }: { move: Move }) {
  const boxes = useBoxes(move.id);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [perPage, setPerPage] = useState<PerPage>('8');
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [fitRef, scale] = useFitScale();

  // Default range: every box in the plan, or stickers 1–20 before anything is packed.
  useEffect(() => {
    if (!boxes || from || to) return;
    if (boxes.length) {
      setFrom(String(boxes[0].number));
      setTo(String(boxes[boxes.length - 1].number));
    } else {
      setFrom('1');
      setTo('20');
      setIncludeEmpty(true);
    }
  }, [boxes, from, to]);

  const range = parseRange(from, to);
  const labels: LabelData[] = useMemo(() => {
    if (!range || !boxes) return [];
    const byNumber = new Map(boxes.map((b) => [b.number, b]));
    const out: LabelData[] = [];
    for (let n = range.from; n <= range.to; n++) {
      const box = byNumber.get(n);
      if (box || includeEmpty) out.push({ number: n, box });
    }
    return out;
  }, [range?.from, range?.to, boxes, includeEmpty]); // eslint-disable-line react-hooks/exhaustive-deps

  const size = Number(perPage);
  const sheets: LabelData[][] = [];
  for (let i = 0; i < labels.length; i += size) sheets.push(labels.slice(i, i + size));

  return (
    <>
      <div data-noprint>
        <PageHeader title="Print labels" subtitle={move.name} back="/boxes" />
      </div>
      <main className="labels-page px-4 pb-10">
        <div data-noprint className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2 text-sm text-muted">
              From box
              <input className={inputClass} inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ''))} />
            </label>
            <label className="flex flex-col gap-2 text-sm text-muted">
              To box
              <input className={inputClass} inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ''))} />
            </label>
          </div>
          <Segmented
            label="Labels per A4 page"
            value={perPage}
            onChange={setPerPage}
            options={[
              { value: '8', label: '8 per page' },
              { value: '4', label: '4 per page (large)' },
            ]}
          />
          <button
            type="button"
            role="checkbox"
            aria-checked={includeEmpty}
            onClick={() => setIncludeEmpty(!includeEmpty)}
            className="card flex min-h-12 items-center gap-3 px-4 text-left text-sm"
          >
            <span className={cx('grid size-6 shrink-0 place-items-center rounded-md border-2', includeEmpty ? 'border-accent bg-accent text-white' : 'border-line')}>
              {includeEmpty && '✓'}
            </span>
            Include numbers that have no box yet (print stickers before packing)
          </button>
          <p className="text-sm text-muted" data-testid="label-count">
            {!range
              ? 'Enter a range such as 1 to 40 (up to 500 labels).'
              : `${labels.length} ${labels.length === 1 ? 'label' : 'labels'} on ${sheets.length} A4 ${sheets.length === 1 ? 'page' : 'pages'}`}
          </p>
          <Button variant="primary" disabled={!labels.length} onClick={() => window.print()}>
            <IconPrinter /> Print or save as PDF
          </Button>
          <p className="text-xs text-muted">In the print dialog choose A4, margins “None”, and scale 100 %. Choose “Save as PDF” to keep a copy.</p>
        </div>

        <div ref={fitRef} className="sheets mt-6 flex flex-col gap-4" aria-label="Label sheets preview">
          {sheets.map((sheet, i) => (
            <div
              key={i}
              className="sheet-frame overflow-hidden shadow-lg"
              style={{ width: SHEET_PX * scale, height: SHEET_PX * 1.4143 * scale }}
            >
              <div className="sheet" data-per-page={perPage} data-testid="sheet" style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                {sheet.map((l) => (
                  <Label key={l.number} move={move} data={l} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
