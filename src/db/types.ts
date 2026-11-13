export interface Move {
  id: string;
  name: string;
  fromAddress?: string;
  toAddress?: string;
  createdAt: number;
  isActive: boolean;
  archived: boolean;
}

export const BOX_STATUSES = ['packing', 'packed', 'shipped', 'delivered', 'unpacked'] as const;
export type BoxStatus = (typeof BOX_STATUSES)[number];

export const BOX_SIZES = ['S', 'M', 'L', 'XL'] as const;
export type BoxSize = (typeof BOX_SIZES)[number];

export const FLAG_KEYS = ['fragile', 'priority', 'valuable', 'thisSideUp'] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];
export type BoxFlags = Record<FlagKey, boolean>;

export interface Box {
  id: string;
  moveId: string;
  number: number;
  label?: string;
  fromRoom?: string;
  toRoom?: string;
  category?: string;
  flags: BoxFlags;
  status: BoxStatus;
  weightKg?: number;
  size?: BoxSize;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

/** Fields a user can set when creating/editing a box. */
export type BoxInput = Omit<Box, 'id' | 'createdAt' | 'updatedAt'>;

export interface Item {
  id: string;
  boxId: string;
  name: string;
  quantity: number;
  note?: string;
  /** Sort order within the box (for manual reordering). */
  position: number;
  createdAt: number;
}

export type PhotoKind = 'outside' | 'contents';
export type OcrStatus = 'pending' | 'done' | 'failed' | 'skipped';

export interface Photo {
  id: string;
  boxId: string;
  kind: PhotoKind;
  blob: Blob;
  thumbBlob: Blob;
  /** Size of the stored (compressed) image in px. */
  width?: number;
  height?: number;
  createdAt: number;
  ocrText?: string;
  ocrStatus: OcrStatus;
}

export interface AppSettings {
  rooms: string[];
  categories: string[];
  ocrEnabled: boolean;
  ocrLanguage: string;
  theme: 'light' | 'dark' | 'system';
  persistRequested: boolean;
  lastBackupAt?: number;
}

export interface SettingRow {
  key: keyof AppSettings;
  value: unknown;
}

export const DEFAULT_ROOMS = [
  'Kitchen',
  'Master Bedroom',
  'Kids Room',
  'Living',
  'Study',
  'Bathroom',
  'Store',
  'Balcony',
  'Garage',
];

export const DEFAULT_CATEGORIES = [
  'Kitchen',
  'Books',
  'Clothes',
  'Documents',
  'Electronics',
  'Toys',
  'Tools',
  'Decor',
  'Linen',
  'Misc',
];

export const DEFAULT_SETTINGS: AppSettings = {
  rooms: DEFAULT_ROOMS,
  categories: DEFAULT_CATEGORIES,
  ocrEnabled: true,
  ocrLanguage: 'eng',
  theme: 'system',
  persistRequested: false,
};

export const NO_FLAGS: BoxFlags = { fragile: false, priority: false, valuable: false, thisSideUp: false };
