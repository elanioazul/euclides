import type { LineString, Position } from 'geojson';
import { SegmentMode } from './enums/segment-mode.enum.js';
import { RouteType } from './enums/route-type.enum.js';

export const samePosition = (a: Position, b: Position): boolean => a[0] === b[0] && a[1] === b[1];

// Concatenates legs in their given order. When a leg starts where the previous one ended,
// that shared vertex is kept once; otherwise the gap becomes a straight connector.
export function stitchLegs(legs: Position[][]): LineString {
  const coordinates: Position[] = [];
  for (const leg of legs) {
    const last = coordinates.at(-1);
    const first = leg[0];
    const skipFirst = last !== undefined && first !== undefined && samePosition(last, first);
    coordinates.push(...(skipFirst ? leg.slice(1) : leg));
  }
  return { type: 'LineString', coordinates };
}

export function deriveRouteType(modes: SegmentMode[]): RouteType {
  const manualCount = modes.filter((mode) => mode === SegmentMode.Manual).length;
  if (manualCount === modes.length) return RouteType.Random;
  if (manualCount === 0) return RouteType.Ors;
  return RouteType.Hybrid;
}
