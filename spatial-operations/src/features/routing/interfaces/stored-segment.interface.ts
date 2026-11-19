import type { LineString } from 'geojson';
import { SegmentMode } from '../enums/segment-mode.enum.js';

// Shape of each item persisted in routing.routes.segments (jsonb): the user's original input
export interface StoredSegment {
  mode: SegmentMode;
  geometry: LineString;
}
