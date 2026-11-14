import { getSettings, setCategories, setRooms, setSetting } from './settings';
import { DEFAULT_ROOMS } from './types';

describe('settings', () => {
  it('returns defaults when nothing is stored', async () => {
    const s = await getSettings();
    expect(s.rooms).toEqual(DEFAULT_ROOMS);
    expect(s.ocrEnabled).toBe(true);
  });

  it('stores values and de-duplicates lists case-insensitively', async () => {
    await setRooms(['Kitchen', ' kitchen ', 'Loft', '']);
    await setCategories(['Books']);
    await setSetting('ocrEnabled', false);
    const s = await getSettings();
    expect(s.rooms).toEqual(['Kitchen', 'Loft']);
    expect(s.categories).toEqual(['Books']);
    expect(s.ocrEnabled).toBe(false);
  });
});
