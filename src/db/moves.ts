import { db } from './schema';
import { ValidationError } from './errors';
import type { Move } from './types';
import { newId } from '../lib/id';

export interface MoveInput {
  name: string;
  fromAddress?: string;
  toAddress?: string;
}

function clean(input: MoveInput): MoveInput {
  const name = input.name.trim();
  if (!name) throw new ValidationError('Move name is required');
  return {
    name,
    fromAddress: input.fromAddress?.trim() || undefined,
    toAddress: input.toAddress?.trim() || undefined,
  };
}

export async function listMoves(): Promise<Move[]> {
  return db.moves.orderBy('createdAt').toArray();
}

export async function getMove(id: string): Promise<Move | undefined> {
  return db.moves.get(id);
}

export async function getActiveMove(): Promise<Move | undefined> {
  return db.moves.filter((m) => m.isActive && !m.archived).first();
}

/** Creates a move. The new move becomes active unless `makeActive` is false. */
export async function createMove(input: MoveInput, makeActive = true): Promise<Move> {
  const data = clean(input);
  return db.transaction('rw', db.moves, async () => {
    const hasActive = (await db.moves.filter((m) => m.isActive).count()) > 0;
    const active = makeActive || !hasActive;
    if (active) await db.moves.toCollection().modify({ isActive: false });
    const move: Move = { id: newId(), ...data, createdAt: Date.now(), isActive: active, archived: false };
    await db.moves.add(move);
    return move;
  });
}

export async function updateMove(id: string, input: MoveInput): Promise<void> {
  const data = clean(input);
  const n = await db.moves.update(id, { ...data });
  if (!n && !(await db.moves.get(id))) throw new ValidationError('Move not found');
}

export async function setActiveMove(id: string): Promise<void> {
  await db.transaction('rw', db.moves, async () => {
    const move = await db.moves.get(id);
    if (!move) throw new ValidationError('Move not found');
    await db.moves.toCollection().modify({ isActive: false });
    await db.moves.update(id, { isActive: true, archived: false });
  });
}

/**
 * Archives a move (its boxes are kept). If it was the active move, the most recent
 * other non-archived move becomes active.
 */
export async function archiveMove(id: string): Promise<void> {
  await db.transaction('rw', db.moves, async () => {
    const move = await db.moves.get(id);
    if (!move) throw new ValidationError('Move not found');
    await db.moves.update(id, { archived: true, isActive: false });
    if (move.isActive) {
      const others = await db.moves.orderBy('createdAt').reverse().filter((m) => !m.archived).toArray();
      if (others[0]) await db.moves.update(others[0].id, { isActive: true });
    }
  });
}

export async function unarchiveMove(id: string): Promise<void> {
  await db.transaction('rw', db.moves, async () => {
    await db.moves.update(id, { archived: false });
    const hasActive = (await db.moves.filter((m) => m.isActive && !m.archived).count()) > 0;
    if (!hasActive) await db.moves.update(id, { isActive: true });
  });
}
