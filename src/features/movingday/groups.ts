import type { Box } from '../../db';

const byNumber = (a: Box, b: Box) => a.number - b.number;

export interface DeliveryGroups {
  /** Shipped but not yet arrived – these are the "missing" boxes. */
  onTheWay: Box[];
  /** Still packing/packed: not marked as on the truck, but not arrived either. */
  notShipped: Box[];
  /** Delivered or unpacked, most recent first. */
  arrived: Box[];
  total: number;
}

export function deliveryGroups(boxes: Box[]): DeliveryGroups {
  const onTheWay: Box[] = [];
  const notShipped: Box[] = [];
  const arrived: Box[] = [];
  for (const b of boxes) {
    if (b.status === 'shipped') onTheWay.push(b);
    else if (b.status === 'delivered' || b.status === 'unpacked') arrived.push(b);
    else notShipped.push(b);
  }
  return {
    onTheWay: onTheWay.sort(byNumber),
    notShipped: notShipped.sort(byNumber),
    arrived: arrived.sort((a, b) => b.updatedAt - a.updatedAt || byNumber(a, b)),
    total: boxes.length,
  };
}

export interface UnpackGroups {
  /** Delivered, not yet emptied: "open first" boxes first, then by destination room, then number. */
  toUnpack: Box[];
  done: Box[];
}

export function unpackGroups(boxes: Box[]): UnpackGroups {
  const toUnpack = boxes
    .filter((b) => b.status === 'delivered')
    .sort(
      (a, b) =>
        Number(b.flags.priority) - Number(a.flags.priority) ||
        (a.toRoom ?? '￿').localeCompare(b.toRoom ?? '￿') ||
        byNumber(a, b),
    );
  const done = boxes.filter((b) => b.status === 'unpacked').sort(byNumber);
  return { toUnpack, done };
}
