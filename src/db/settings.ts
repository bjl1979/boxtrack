import { db } from './schema';
import { DEFAULT_SETTINGS, type AppSettings } from './types';

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.settings.toArray();
  const out: AppSettings = { ...DEFAULT_SETTINGS };
  for (const row of rows) (out as unknown as Record<string, unknown>)[row.key] = row.value;
  return out;
}

export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
  await db.settings.put({ key, value });
}

function cleanList(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const v = raw.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

export async function setRooms(rooms: string[]): Promise<void> {
  await setSetting('rooms', cleanList(rooms));
}

export async function setCategories(categories: string[]): Promise<void> {
  await setSetting('categories', cleanList(categories));
}
