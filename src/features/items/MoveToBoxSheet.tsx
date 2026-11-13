import { useOtherBoxes } from '../../db';
import { Sheet } from '../../components/Sheet';

/** Pick another box in the same move. */
export function MoveToBoxSheet({
  open,
  moveId,
  currentBoxId,
  title,
  onClose,
  onPick,
}: {
  open: boolean;
  moveId: string;
  currentBoxId: string;
  title: string;
  onClose: () => void;
  onPick: (boxId: string, number: number) => void;
}) {
  const boxes = useOtherBoxes(open ? moveId : undefined, currentBoxId);
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      {boxes && boxes.length === 0 && <p className="py-6 text-center text-muted">There are no other boxes in this move yet.</p>}
      <ul className="flex flex-col gap-2">
        {boxes?.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => onPick(b.id, b.number)}
              className="card flex w-full items-center gap-3 p-2 text-left active:scale-[0.99]"
              aria-label={`Box ${b.number}${b.label ? ` ${b.label}` : ''}`}
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-bg-deep text-xl font-bold tabular-nums">
                {b.number}
              </span>
              <span className="truncate">{b.label ?? <span className="text-muted">No label</span>}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
