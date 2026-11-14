import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { db } from '../db/schema';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});
