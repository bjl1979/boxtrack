import type { BoxStatus, FlagKey } from '../../db';

export const STATUS_META: Record<BoxStatus, { label: string; color: string }> = {
  packing: { label: 'Packing', color: 'var(--c-packing)' },
  packed: { label: 'Packed', color: 'var(--c-packed)' },
  shipped: { label: 'Shipped', color: 'var(--c-shipped)' },
  delivered: { label: 'Delivered', color: 'var(--c-delivered)' },
  unpacked: { label: 'Unpacked', color: 'var(--c-unpacked)' },
};

export const FLAG_META: Record<FlagKey, { label: string; icon: string }> = {
  fragile: { label: 'Fragile', icon: '🍷' },
  priority: { label: 'Open first', icon: '⭐' },
  valuable: { label: 'Valuable', icon: '💎' },
  thisSideUp: { label: 'This side up', icon: '⬆️' },
};
