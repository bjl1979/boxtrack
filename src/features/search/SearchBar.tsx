import { Link } from 'react-router';
import { IconSearch } from '../../components/Icons';

/** Tappable search pill that opens the search screen. */
export function SearchBar({ placeholder = 'Search items, rooms, photo text…' }: { placeholder?: string }) {
  return (
    <Link
      to="/search"
      className="inset flex min-h-13 items-center gap-3 rounded-full px-5 text-muted active:scale-[0.99]"
      aria-label="Search"
      data-testid="search-bar"
    >
      <span className="flex-1 truncate">{placeholder}</span>
      <IconSearch />
    </Link>
  );
}
