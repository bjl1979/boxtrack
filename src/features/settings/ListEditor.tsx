import { useState, type FormEvent } from 'react';
import { IconX } from '../../components/Icons';
import { Button } from '../../components/ui';
import { inputClass } from '../moves/MoveForm';

/** Editable list of chips (rooms, categories). */
export function ListEditor({
  label,
  singular,
  values,
  onChange,
}: {
  label: string;
  /** e.g. "room", "category" – used in "Add room". */
  singular: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  function add(e: FormEvent) {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft('');
  }
  return (
    <div className="card p-4">
      <ul className="flex flex-wrap gap-2" aria-label={label}>
        {values.map((v) => (
          <li key={v} className="inset flex min-h-11 items-center gap-1 rounded-full pr-1 pl-4 text-sm">
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="grid size-9 place-items-center text-muted"
            >
              <IconX width={16} height={16} />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input
          className={inputClass}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Add ${singular}`}
          aria-label={`New ${singular}`}
        />
        <Button type="submit" variant="primary" disabled={!draft.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}
