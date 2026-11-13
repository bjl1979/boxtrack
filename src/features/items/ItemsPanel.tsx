import { useRef, useState, type FormEvent } from 'react';
import {
  MAX_QUANTITY,
  addItem,
  deleteItems,
  moveItems,
  parseItemEntry,
  reorderItems,
  setItemQuantity,
  updateItem,
  useItems,
  type Box,
  type Item,
} from '../../db';
import { Stepper } from '../../components/Stepper';
import { Button, cx } from '../../components/ui';
import { IconCheck, IconDown, IconPlus, IconUp } from '../../components/Icons';
import { useToast } from '../../components/Toast';
import { inputClass } from '../moves/MoveForm';
import { ItemEditSheet } from './ItemEditSheet';
import { MoveToBoxSheet } from './MoveToBoxSheet';

export function ItemsPanel({ box }: { box: Box }) {
  const items = useItems(box.id);
  const [draft, setDraft] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Item | null>(null);
  const [moving, setMoving] = useState<string[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const parsed = parseItemEntry(draft);
    setDraft('');
    inputRef.current?.focus(); // keep the keyboard up for the next item
    await addItem(box.id, { name: parsed.name, quantity: Math.min(parsed.quantity, MAX_QUANTITY) });
  }

  function move(index: number, dir: -1 | 1) {
    if (!items) return;
    const ids = items.map((i) => i.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void reorderItems(box.id, ids);
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const pieces = items?.reduce((n, i) => n + i.quantity, 0) ?? 0;

  return (
    <div className={cx(editMode && selected.size > 0 && 'pb-24')}>
      <form onSubmit={add} className="flex gap-2">
        <input
          ref={inputRef}
          className={inputClass}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add item, e.g. 3x plates"
          aria-label="New item"
          enterKeyHint="enter"
          autoComplete="off"
        />
        <button type="submit" aria-label="Add item" disabled={!draft.trim()} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-white disabled:opacity-40">
          <IconPlus />
        </button>
      </form>

      {items && items.length > 0 && (
        <div className="mt-4 mb-2 flex items-center justify-between px-1">
          <span className="text-sm text-muted" data-testid="item-summary">
            {items.length} {items.length === 1 ? 'item' : 'items'}
            {pieces !== items.length && ` · ${pieces} pieces`}
          </span>
          <button
            type="button"
            className="min-h-11 px-2 font-semibold text-accent"
            onClick={() => {
              setEditMode(!editMode);
              setSelected(new Set());
            }}
          >
            {editMode ? 'Done' : 'Edit list'}
          </button>
        </div>
      )}

      {items?.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">No items yet. Type a name and press Enter – the field stays ready for the next one.</p>
      )}

      <ul className="flex flex-col gap-2" aria-label="Items">
        {items?.map((item, i) => (
          <li key={item.id} className="card flex min-h-16 items-center gap-2 py-2 pr-2 pl-4" data-testid="item-row">
            {editMode ? (
              <>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selected.has(item.id)}
                  aria-label={`Select ${item.name}`}
                  onClick={() => toggle(item.id)}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className={cx(
                      'grid size-6 shrink-0 place-items-center rounded-md border-2',
                      selected.has(item.id) ? 'border-accent bg-accent text-white' : 'border-line',
                    )}
                  >
                    {selected.has(item.id) && <IconCheck width={16} height={16} />}
                  </span>
                  <span className="truncate">{item.name}</span>
                </button>
                <button type="button" aria-label={`Move ${item.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="grid size-11 place-items-center text-muted disabled:opacity-30">
                  <IconUp />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${item.name} down`}
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                  className="grid size-11 place-items-center text-muted disabled:opacity-30"
                >
                  <IconDown />
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setEditing(item)} className="min-h-11 min-w-0 flex-1 text-left">
                  <span className="block truncate">{item.name}</span>
                  {item.note && <span className="block truncate text-xs text-muted">{item.note}</span>}
                </button>
                <Stepper
                  label={`quantity of ${item.name}`}
                  value={item.quantity}
                  max={MAX_QUANTITY}
                  onChange={(q) => void setItemQuantity(item.id, q)}
                />
              </>
            )}
          </li>
        ))}
      </ul>

      {editMode && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg gap-3 bg-bg/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur">
          <Button className="flex-1" onClick={() => setMoving([...selected])}>
            Move to box…
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              await deleteItems([...selected]);
              toast.show(`${selected.size} deleted`);
              setSelected(new Set());
            }}
          >
            Delete ({selected.size})
          </Button>
        </div>
      )}

      {editing && (
        <ItemEditSheet
          key={editing.id}
          item={editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            await updateItem(editing.id, v);
            setEditing(null);
          }}
          onDelete={async () => {
            await deleteItems([editing.id]);
            setEditing(null);
            toast.show('Item deleted');
          }}
          onMove={() => {
            setMoving([editing.id]);
            setEditing(null);
          }}
        />
      )}

      <MoveToBoxSheet
        open={!!moving}
        moveId={box.moveId}
        currentBoxId={box.id}
        title={moving && moving.length > 1 ? `Move ${moving.length} items to…` : 'Move item to…'}
        onClose={() => setMoving(null)}
        onPick={async (target, number) => {
          if (!moving) return;
          await moveItems(moving, target);
          toast.show(`Moved to box ${number}`);
          setMoving(null);
          setSelected(new Set());
        }}
      />
      {toast.node}
    </div>
  );
}
