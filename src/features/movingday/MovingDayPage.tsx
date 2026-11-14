import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { setBoxStatus, useBoxes, type Box, type BoxStatus, type Move } from '../../db';
import { PageHeader } from '../../components/AppShell';
import { Button, Segmented, SectionTitle } from '../../components/ui';
import { IconQr, IconX } from '../../components/Icons';
import { roomsText } from '../boxes/BoxRow';
import { QrCamera } from '../qr/QrCamera';
import { parseLabel } from '../qr/labelCode';
import { deliveryGroups, unpackGroups } from './groups';

type Tab = 'delivery' | 'unpack';

interface Undo {
  message: string;
  boxId: string;
  previous: BoxStatus;
}

/** Toast with an Undo button, so a mistaken tap or scan is easy to reverse. */
function useUndoToast() {
  const [undo, setUndo] = useState<Undo | null>(null);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 4000);
    return () => clearTimeout(t);
  }, [undo]);
  const node = undo ? (
    <div role="status" className="fixed inset-x-4 bottom-6 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-[var(--c-delivered)] p-3 pl-5 font-semibold text-bg-deep shadow-xl">
      <span className="flex-1">{undo.message}</span>
      <button
        type="button"
        className="min-h-11 rounded-xl bg-black/15 px-4"
        onClick={() => {
          void setBoxStatus([undo.boxId], undo.previous);
          setUndo(null);
        }}
      >
        Undo
      </button>
    </div>
  ) : null;
  return { show: setUndo, node };
}

function BoxLine({ box, action, testId }: { box: Box; action: ReactNode; testId: string }) {
  return (
    <li className="card flex items-center gap-3 p-2 pr-3" data-testid={testId} data-number={box.number}>
      <Link to={`/boxes/${box.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-bg-deep text-2xl font-bold tabular-nums" aria-label={`Box ${box.number}`}>
          {box.number}
        </span>
        <span className="min-w-0">
          <span className={`block truncate font-semibold ${box.label ? '' : 'text-muted'}`}>
            {box.flags.priority && <span title="Open first">⭐ </span>}
            {box.label ?? 'No label'}
          </span>
          <span className="block truncate text-sm text-muted">{roomsText(box) || '—'}</span>
        </span>
      </Link>
      {action}
    </li>
  );
}

function Collapsible({ title, count, children, testId }: { title: string; count: number; children: ReactNode; testId: string }) {
  const [open, setOpen] = useState(false);
  if (!count) return null;
  return (
    <section className="mt-6">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-11 w-full items-center justify-between px-1 text-sm font-semibold text-muted" data-testid={testId}>
        <span>
          {title} ({count})
        </span>
        <span aria-hidden>{open ? '▲' : '▼'}</span>
      </button>
      {open && <ul className="mt-2 flex flex-col gap-2">{children}</ul>}
    </section>
  );
}

function DeliveryCheck({ move, boxes }: { move: Move; boxes: Box[] }) {
  const g = deliveryGroups(boxes);
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const lastSeen = useRef(new Map<string, number>());
  const toast = useUndoToast();
  const arrivedCount = g.arrived.length;
  const pct = g.total ? Math.round((arrivedCount / g.total) * 100) : 0;

  async function arrive(box: Box, how: 'scan' | 'tap') {
    await setBoxStatus([box.id], 'delivered');
    toast.show({ message: `Box ${box.number} arrived ✓`, boxId: box.id, previous: box.status });
    if (how === 'scan') navigator.vibrate?.(60);
  }

  function onScan(text: string) {
    // The camera sees the same label many times a second: handle each code once every 3 s.
    const now = Date.now();
    if (now - (lastSeen.current.get(text) ?? 0) < 3000) return;
    lastSeen.current.set(text, now);
    const ref = parseLabel(text);
    if (!ref) return setNote('That code is not a BoxTrack label.');
    if (ref.moveId && ref.moveId !== move.id) return setNote('That label belongs to a different packing plan.');
    const box = boxes.find((b) => b.number === ref.number);
    if (!box) return setNote(`There is no box ${ref.number} in this plan.`);
    if (box.status === 'delivered' || box.status === 'unpacked') return setNote(`Box ${box.number} has already arrived.`);
    setNote(null);
    void arrive(box, 'scan');
  }

  const arriveBtn = (b: Box) => (
    <Button variant="primary" className="min-h-11 shrink-0 px-4 text-sm" onClick={() => void arrive(b, 'tap')} aria-label={`Box ${b.number} arrived`}>
      Arrived
    </Button>
  );

  return (
    <>
      <div className="card p-4" data-testid="delivery-progress">
        <div className="flex items-end justify-between">
          <p>
            <span className="text-3xl font-semibold tabular-nums">{arrivedCount}</span>
            <span className="text-muted"> of {g.total} arrived</span>
          </p>
          <p className="text-sm" style={{ color: g.onTheWay.length ? 'var(--c-missing)' : 'var(--c-delivered)' }}>
            {g.onTheWay.length ? `${g.onTheWay.length} missing` : g.total && arrivedCount === g.total ? 'All here 🎉' : ''}
          </p>
        </div>
        <div className="inset mt-3 h-2.5 overflow-hidden">
          <div className="h-full rounded-full bg-[var(--c-delivered)] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {scanning ? (
        <div className="mt-4 overflow-hidden rounded-3xl">
          <QrCamera className="h-72" onText={onScan} />
          <div className="flex items-center gap-2 bg-surface p-3">
            <p role="status" className="flex-1 text-sm text-muted">
              {note ?? 'Scan each label as the box comes off the truck.'}
            </p>
            <button type="button" onClick={() => setScanning(false)} aria-label="Stop scanning" className="grid size-11 place-items-center rounded-full bg-bg-deep">
              <IconX />
            </button>
          </div>
        </div>
      ) : (
        <Button variant="primary" className="mt-4 w-full" onClick={() => setScanning(true)}>
          <IconQr /> Scan boxes as they arrive
        </Button>
      )}

      <SectionTitle>Still on the way ({g.onTheWay.length})</SectionTitle>
      {g.onTheWay.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">
          {g.total === 0 ? 'No boxes in this plan yet.' : 'Nothing is missing. Boxes marked “Shipped” appear here until they arrive.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Missing boxes">
          {g.onTheWay.map((b) => (
            <BoxLine key={b.id} box={b} testId="missing-box" action={arriveBtn(b)} />
          ))}
        </ul>
      )}

      <Collapsible title="Not marked as shipped" count={g.notShipped.length} testId="not-shipped-toggle">
        {g.notShipped.map((b) => (
          <BoxLine key={b.id} box={b} testId="not-shipped-box" action={arriveBtn(b)} />
        ))}
      </Collapsible>

      <Collapsible title="Arrived" count={g.arrived.length} testId="arrived-toggle">
        {g.arrived.map((b) => (
          <BoxLine
            key={b.id}
            box={b}
            testId="arrived-box"
            action={<span className="shrink-0 text-sm font-semibold text-[var(--c-delivered)]">✓ {b.status === 'unpacked' ? 'Unpacked' : 'Here'}</span>}
          />
        ))}
      </Collapsible>
      {toast.node}
    </>
  );
}

function Unpacking({ boxes }: { boxes: Box[] }) {
  const g = unpackGroups(boxes);
  const toast = useUndoToast();
  return (
    <>
      <p className="px-1 text-sm text-muted">
        Delivered boxes, with ⭐ “open first” boxes at the top. Tap a box to see what is inside; mark it emptied when you are done.
      </p>
      <SectionTitle>To unpack ({g.toUnpack.length})</SectionTitle>
      {g.toUnpack.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">
          {g.done.length ? 'Everything that arrived is unpacked. 🎉' : 'Boxes appear here once they are marked as arrived.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Boxes to unpack">
          {g.toUnpack.map((b) => (
            <BoxLine
              key={b.id}
              box={b}
              testId="unpack-box"
              action={
                <Button
                  className="min-h-11 shrink-0 bg-bg-deep px-4 text-sm ring-1 ring-line"
                  aria-label={`Box ${b.number} emptied`}
                  onClick={async () => {
                    await setBoxStatus([b.id], 'unpacked');
                    toast.show({ message: `Box ${b.number} unpacked ✓`, boxId: b.id, previous: 'delivered' });
                  }}
                >
                  Emptied
                </Button>
              }
            />
          ))}
        </ul>
      )}
      <Collapsible title="Unpacked" count={g.done.length} testId="unpacked-toggle">
        {g.done.map((b) => (
          <BoxLine key={b.id} box={b} testId="unpacked-box" action={<span className="shrink-0 text-sm text-muted">✓ Empty</span>} />
        ))}
      </Collapsible>
      {toast.node}
    </>
  );
}

export function MovingDayPage({ move }: { move: Move }) {
  const boxes = useBoxes(move.id);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'delivery';
  const missing = boxes ? deliveryGroups(boxes).onTheWay.length : 0;
  return (
    <>
      <PageHeader title="Moving day" subtitle={move.name} back="/boxes" />
      <main className="px-4 pb-24">
        <div className="mb-4">
          <Segmented
            label="Moving day section"
            value={tab}
            onChange={(t) => setParams({ tab: t }, { replace: true })}
            options={[
              { value: 'delivery', label: missing ? `Delivery check (${missing})` : 'Delivery check' },
              { value: 'unpack', label: 'Unpacking' },
            ]}
          />
        </div>
        {boxes && (tab === 'delivery' ? <DeliveryCheck move={move} boxes={boxes} /> : <Unpacking boxes={boxes} />)}
      </main>
    </>
  );
}
