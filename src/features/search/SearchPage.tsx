import { useMemo } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useBoxes, type Box, type Move } from '../../db';
import { IconBack, IconSearch, IconX } from '../../components/Icons';
import { STATUS_META } from '../boxes/statusMeta';
import { roomsText } from '../boxes/BoxRow';
import { highlight, snippet } from './highlight';
import { SOURCE_LABEL, type BoxHit, type Match } from './searchIndex';
import { useSearch } from './useSearch';

function Highlighted({ match }: { match: Match }) {
  const segs = snippet(highlight(match.text.replace(/\s+/g, ' '), match.terms), 90);
  return (
    <span>
      {segs.map((s, i) =>
        s.hit ? (
          <mark key={i} className="rounded bg-accent/30 px-0.5 text-text">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  );
}

function linkFor(box: Box, match?: Match): string {
  if (match?.photoId) return `/boxes/${box.id}?tab=photos&highlight=${match.photoId}`;
  if (match?.itemId) return `/boxes/${box.id}?tab=items&highlight=${match.itemId}`;
  if (match) return `/boxes/${box.id}?tab=details`;
  return `/boxes/${box.id}`;
}

function ResultCard({ box, hit }: { box: Box; hit?: BoxHit }) {
  const status = STATUS_META[box.status];
  const rooms = roomsText(box);
  return (
    <li className="card overflow-hidden" data-testid="search-result">
      <Link to={linkFor(box, hit?.matches[0])} className="flex items-center gap-3 p-3 pb-2">
        <span
          className="grid size-16 shrink-0 place-items-center rounded-2xl bg-bg-deep text-3xl font-bold tabular-nums"
          aria-label={`Box ${box.number}`}
        >
          {box.number}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-semibold ${box.label ? '' : 'text-muted'}`}>{box.label ?? 'No label'}</span>
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <span className="size-2 shrink-0 rounded-full" style={{ background: status.color }} />
            <span className="truncate">{[status.label, rooms].filter(Boolean).join(' · ')}</span>
          </span>
        </span>
      </Link>
      {hit && (
        <ul className="px-3 pb-3">
          {hit.matches.map((m, i) => (
            <li key={i}>
              <Link to={linkFor(box, m)} className="flex min-h-11 items-start gap-2 rounded-xl px-1 py-2 text-sm active:bg-bg-deep">
                <span className="mt-0.5 shrink-0 rounded-full bg-bg-deep px-2 py-0.5 text-[11px] text-muted">
                  {SOURCE_LABEL[m.source]}
                </span>
                <span className="min-w-0 flex-1 break-words" data-testid="match-text">
                  <Highlighted match={m} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function SearchPage({ move }: { move: Move }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const boxes = useBoxes(move.id);
  const { hits, ready } = useSearch(query, move.id);
  const boxById = useMemo(() => new Map((boxes ?? []).map((b) => [b.id, b])), [boxes]);

  // Typing a number jumps straight to that box.
  const numberBox = /^\d+$/.test(query.trim()) ? boxes?.find((b) => b.number === Number(query.trim())) : undefined;
  const results = hits.filter((h) => boxById.has(h.boxId) && h.boxId !== numberBox?.id);

  const setQuery = (q: string) => setParams(q ? { q } : {}, { replace: true });

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-bg/90 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur">
        <button type="button" aria-label="Back" onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/'))} className="card grid size-12 shrink-0 place-items-center">
          <IconBack />
        </button>
        <form
          role="search"
          className="inset flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-full pr-1 pl-4 focus-within:ring-2 focus-within:ring-accent"
          onSubmit={(e) => {
            e.preventDefault();
            (document.activeElement as HTMLElement | null)?.blur(); // hide keyboard to see results
          }}
        >
          <IconSearch className="shrink-0 text-muted" width={20} height={20} />
          <input
            autoFocus
            type="search"
            enterKeyHint="search"
            aria-label="Search boxes"
            placeholder={`Search ${move.name}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full min-w-0 flex-1 bg-transparent py-2 text-text outline-none focus-visible:outline-none placeholder:text-muted/70 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="grid size-10 place-items-center text-muted">
              <IconX width={18} height={18} />
            </button>
          )}
        </form>
      </header>

      <main className="px-4 pb-6">
        {!query.trim() && (
          <p className="mt-6 px-2 text-center text-sm text-muted">
            Search item names, labels, notes, rooms, categories and text read from photos. Small typos are fine. Type a
            number to jump to that box.
          </p>
        )}

        {query.trim() && ready && !numberBox && results.length === 0 && (
          <p className="card mt-4 px-4 py-8 text-center text-muted">No box matches “{query.trim()}”.</p>
        )}

        <ul className="mt-2 flex flex-col gap-3" aria-label="Search results">
          {numberBox && <ResultCard box={numberBox} />}
          {results.map((h) => (
            <ResultCard key={h.boxId} box={boxById.get(h.boxId)!} hit={h} />
          ))}
        </ul>
      </main>
    </>
  );
}
