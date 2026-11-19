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

  it('joins consecutive ors legs whose snapped ends differ through a connector', () => {
    const line = stitchLegs([
      [[0, 0], [0.5, 0.5], [0.9999, 1]],
      [[1.0002, 1], [1.5, 1.5], [2, 2]],
    ]);
    expect(line.coordinates).toEqual([[0, 0], [0.5, 0.5], [0.9999, 1], [1.0002, 1], [1.5, 1.5], [2, 2]]);
  });

  it('always returns one LineString with no repeated consecutive vertices at the joins', () => {
    const line = stitchLegs([
      [[0, 0], [1, 1]],
      [[1, 1], [2, 2]],
      [[2, 2], [3, 3]],
      [[3, 3], [4, 4]],
    ]);
    expect(line.type).toBe('LineString');
    expect(line.coordinates).toEqual([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]]);
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
