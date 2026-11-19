import type { LineString } from 'geojson';

// Subset of the ORS v2 /directions/{profile}/geojson response used by this API

export interface OrsStep {
  distance: number;
  duration: number;
  type: number;
  instruction: string;
  name: string;
  way_points: [number, number];
  exit_number?: number;
}

// ORS omits distance/duration when they are 0 (e.g. a zero-length route)
export interface OrsLegSegment {
  distance?: number;
  duration?: number;
  steps?: OrsStep[];
}

export interface OrsSummary {
  distance?: number;
  duration?: number;
}

export interface OrsWarning {
  code: number;
  message: string;
}

export interface OrsRouteProperties {
  summary: OrsSummary;
  segments: OrsLegSegment[];
  way_points: number[];
  warnings?: OrsWarning[];
}

export interface OrsDirectionsFeature {
  type: 'Feature';
  bbox?: number[];
  geometry: LineString;
  properties: OrsRouteProperties;
}

export interface OrsDirectionsResponse {
  type: 'FeatureCollection';
  bbox?: number[];
  features: OrsDirectionsFeature[];
}

export interface OrsErrorBody {
  error?: { code?: number; message?: string } | string;
}

export interface OrsRoute {
  geometry: LineString;
  properties: OrsRouteProperties;
}
