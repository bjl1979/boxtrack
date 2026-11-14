import { useState } from 'react';
import { MAX_QUANTITY, type Item } from '../../db';
import { Sheet } from '../../components/Sheet';
import { Stepper } from '../../components/Stepper';
import { Button } from '../../components/ui';
import { IconMoveTo, IconTrash } from '../../components/Icons';
import { inputClass } from '../moves/MoveForm';

export function ItemEditSheet({
  item,
  onClose,
  onSave,
  onDelete,
  onMove,
}: {
  item: Item;
  onClose: () => void;
  onSave: (v: { name: string; quantity: number; note: string }) => Promise<void>;
  onDelete: () => void;
  onMove: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note ?? '');
  const [quantity, setQuantity] = useState(item.quantity);
  return (
    <Sheet
      open
      title="Edit item"
      onClose={onClose}
      footer={
        <Button variant="primary" className="w-full" disabled={!name.trim()} onClick={() => void onSave({ name, quantity, note })}>
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm text-muted">
          Name
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-2 text-sm text-muted">
          Note
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </label>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Quantity</span>
          <Stepper label="quantity" value={quantity} max={MAX_QUANTITY} onChange={setQuantity} />
        </div>
        <div className="flex gap-3">
          <Button className="flex-1" onClick={onMove}>
            <IconMoveTo /> Move to box
          </Button>
          <Button variant="danger" className="flex-1" onClick={onDelete}>
            <IconTrash /> Delete
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
