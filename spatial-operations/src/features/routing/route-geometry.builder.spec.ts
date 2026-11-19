import { deriveRouteType, stitchLegs } from './route-geometry.builder.js';
import { SegmentMode } from './enums/segment-mode.enum.js';
import { RouteType } from './enums/route-type.enum.js';

describe('stitchLegs', () => {
  it('returns a single leg unchanged as a LineString', () => {
    expect(stitchLegs([[[0, 0], [1, 1]]])).toEqual({ type: 'LineString', coordinates: [[0, 0], [1, 1]] });
  });

  it('keeps the shared boundary vertex only once', () => {
    const line = stitchLegs([
      [[0, 0], [1, 1]],
      [[1, 1], [2, 2]],
    ]);
    expect(line.coordinates).toEqual([[0, 0], [1, 1], [2, 2]]);
  });

  it('keeps leg order and turns a gap between legs into a connector', () => {
    const line = stitchLegs([
      [[0, 0], [1, 1]],
      [[1.001, 1.001], [2, 2]],
      [[2, 2], [0, 0]],
    ]);
    expect(line.coordinates).toEqual([[0, 0], [1, 1], [1.001, 1.001], [2, 2], [0, 0]]);
  });
});

describe('deriveRouteType', () => {
  it('is random when every segment is manual', () => {
    expect(deriveRouteType([SegmentMode.Manual, SegmentMode.Manual])).toBe(RouteType.Random);
  });

  it('is ors when every segment is ors', () => {
    expect(deriveRouteType([SegmentMode.Ors, SegmentMode.Ors])).toBe(RouteType.Ors);
  });

  it('is hybrid when modes are mixed', () => {
    expect(deriveRouteType([SegmentMode.Manual, SegmentMode.Ors])).toBe(RouteType.Hybrid);
  });
});
