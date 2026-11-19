import type { LineString } from 'geojson';
import { SegmentMode } from '../enums/segment-mode.enum.js';
import type { OrsRouteProperties } from '../../../core/infrastructure/ors/ors.types.js';

// Shape of each item persisted in routing.routes.segments (jsonb): the user's original input
export interface StoredSegment {
  mode: SegmentMode;
  // manual: the drawn line; ors: the waypoints sent to ORS
  geometry: LineString;
  // ors only: features[0].properties of the ORS response (summary, way_points, steps)
  orsProperties?: OrsRouteProperties;
}
