import { FLAG_KEYS, type FlagKey } from '../../db';
import { Button, Chip } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { EMPTY_FILTERS, type BoxFilters } from './filters';
import { FLAG_META } from './statusMeta';

export type FilterSection = 'rooms' | 'categories' | 'flags';

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function FilterSheet({
  open,
  onClose,
  filters,
  onChange,
  rooms,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  filters: BoxFilters;
  onChange: (f: BoxFilters) => void;
  rooms: string[];
  categories: string[];
}) {
  return (
    <Sheet
      open={open}
      title="Filter boxes"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button className="flex-1" onClick={() => onChange({ ...EMPTY_FILTERS, statuses: filters.statuses })}>
            Clear
          </Button>
          <Button className="flex-1" variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <h3 className="mt-2 mb-2 text-sm text-muted">Room (from or to)</h3>
      <div className="flex flex-wrap gap-2">
        {rooms.map((r) => (
          <Chip key={r} selected={filters.rooms.includes(r)} onClick={() => onChange({ ...filters, rooms: toggle(filters.rooms, r) })}>
            {r}
          </Chip>
        ))}
      </div>
      <h3 className="mt-5 mb-2 text-sm text-muted">Category</h3>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Chip
            key={c}
            selected={filters.categories.includes(c)}
            onClick={() => onChange({ ...filters, categories: toggle(filters.categories, c) })}
          >
            {c}
          </Chip>
        ))}
      </div>
      <h3 className="mt-5 mb-2 text-sm text-muted">Flags (box must have all chosen)</h3>
      <div className="flex flex-wrap gap-2">
        {FLAG_KEYS.map((k: FlagKey) => (
          <Chip key={k} selected={filters.flags.includes(k)} onClick={() => onChange({ ...filters, flags: toggle(filters.flags, k) })}>
            {FLAG_META[k].icon} {FLAG_META[k].label}
          </Chip>
        ))}
      </div>
    </Sheet>
  );
}
