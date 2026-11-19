import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { RoutingService } from './routing.service.js';
import { Route } from './entities/routing.entity.js';
import { SegmentMode } from './enums/segment-mode.enum.js';
import { RouteType } from './enums/route-type.enum.js';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { SIMPLIFY_TOLERANCE_M } from './consts/routing.consts.js';
import type { StoredSegment } from './interfaces/stored-segment.interface.js';
import {
  SPATIALDB_CONNECTION,
  getPostgisServiceToken,
} from '../../core/infrastructure/postgis/consts/database_constants.js';
import { OrsService } from '../../core/infrastructure/ors/ors.service.js';
import type { OrsRoute } from '../../core/infrastructure/ors/ors.types.js';

describe('RoutingService', () => {
  const postgis = { query: vi.fn() };
  const ors = { getDrivingRoute: vi.fn() };
  const routeRepository = { find: vi.fn() };
  let service: RoutingService;

  const createdAt = new Date('2026-11-19T10:00:00Z');
  const insertedRow = (type: RouteType) => ({ rows: [{ id: 7, name: 'Route', description: null, type, created_at: createdAt }] });
  const insertParams = (): unknown[] => (postgis.query.mock.calls[0] as [string, unknown[]])[1];

  const orsRoute: OrsRoute = {
    geometry: { type: 'LineString', coordinates: [[1.0001, 1.0001], [1.5, 1.5], [2, 2]] },
    properties: { summary: { distance: 1200, duration: 90 }, segments: [], way_points: [0, 2] },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutingService,
        { provide: getRepositoryToken(Route, SPATIALDB_CONNECTION), useValue: routeRepository },
        { provide: getPostgisServiceToken(SPATIALDB_CONNECTION), useValue: postgis },
        { provide: OrsService, useValue: ors },
      ],
    }).compile();

    service = module.get<RoutingService>(RoutingService);
  });

  describe('create', () => {
    it('stores a random route: stitched geometry, derived type and original segments', async () => {
      const dto: CreateRouteDto = {
        name: 'Walk',
        segments: [
          { mode: SegmentMode.Manual, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
          { mode: SegmentMode.Manual, geometry: { type: 'LineString', coordinates: [[1, 1], [2, 2]] } },
        ],
      };
      postgis.query.mockResolvedValue(insertedRow(RouteType.Random));

      const result = await service.create(dto);

      const [sql] = postgis.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO routing.routes');
      expect(sql).toContain('ST_Simplify');
      expect(insertParams()).toEqual([
        'Walk',
        null,
        RouteType.Random,
        JSON.stringify(dto.segments),
        JSON.stringify({ type: 'LineString', coordinates: [[0, 0], [1, 1], [2, 2]] }),
        SIMPLIFY_TOLERANCE_M,
      ]);
      expect(ors.getDrivingRoute).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 7, name: 'Route', description: null, type: RouteType.Random, createdAt });
    });

    it('stores an ors route: road geometry from ORS, waypoints and orsProperties in segments', async () => {
      const waypoints = { type: 'LineString' as const, coordinates: [[1, 1], [2, 2]] };
      ors.getDrivingRoute.mockResolvedValue(orsRoute);
      postgis.query.mockResolvedValue(insertedRow(RouteType.Ors));

      await service.create({ name: 'Drive', segments: [{ mode: SegmentMode.Ors, geometry: waypoints }] });

      expect(ors.getDrivingRoute).toHaveBeenCalledWith(waypoints.coordinates);
      const params = insertParams();
      expect(params[2]).toBe(RouteType.Ors);
      const stored = JSON.parse(params[3] as string) as StoredSegment[];
      expect(stored).toEqual([{ mode: SegmentMode.Ors, geometry: waypoints, orsProperties: orsRoute.properties }]);
      expect(JSON.parse(params[4] as string)).toEqual(orsRoute.geometry);
    });

    it('stitches a hybrid route in segment order, with a connector to the snapped ORS start', async () => {
      ors.getDrivingRoute.mockResolvedValue(orsRoute);
      postgis.query.mockResolvedValue(insertedRow(RouteType.Hybrid));

      await service.create({
        name: 'Mixed',
        segments: [
          { mode: SegmentMode.Manual, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
          { mode: SegmentMode.Ors, geometry: { type: 'LineString', coordinates: [[1, 1], [2, 2]] } },
          { mode: SegmentMode.Manual, geometry: { type: 'LineString', coordinates: [[2, 2], [3, 3]] } },
        ],
      });

      const params = insertParams();
      expect(params[2]).toBe(RouteType.Hybrid);
      const stored = JSON.parse(params[3] as string) as StoredSegment[];
      expect(stored.map((segment) => segment.orsProperties !== undefined)).toEqual([false, true, false]);
      expect(JSON.parse(params[4] as string)).toEqual({
        type: 'LineString',
        coordinates: [[0, 0], [1, 1], [1.0001, 1.0001], [1.5, 1.5], [2, 2], [3, 3]],
      });
    });

    it('keeps a single shared vertex when ORS starts exactly where the previous manual segment ended', async () => {
      ors.getDrivingRoute.mockResolvedValue({ ...orsRoute, geometry: { type: 'LineString', coordinates: [[1, 1], [2, 2]] } });
      postgis.query.mockResolvedValue(insertedRow(RouteType.Hybrid));

      await service.create({
        name: 'Mixed',
        segments: [
          { mode: SegmentMode.Manual, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
          { mode: SegmentMode.Ors, geometry: { type: 'LineString', coordinates: [[1, 1], [2, 2]] } },
        ],
      });

      expect(JSON.parse(insertParams()[4] as string)).toEqual({ type: 'LineString', coordinates: [[0, 0], [1, 1], [2, 2]] });
    });

    it('routes consecutive ors segments separately and stitches them in segment order', async () => {
      const first: OrsRoute = { ...orsRoute, geometry: { type: 'LineString', coordinates: [[0, 0.0001], [1, 1.0001]] } };
      const second: OrsRoute = { ...orsRoute, geometry: { type: 'LineString', coordinates: [[1, 0.9999], [2, 2]] } };
      // The second call resolves first: the stitched order must still follow the segments
      ors.getDrivingRoute
        .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(first), 5)))
        .mockResolvedValueOnce(second);
      postgis.query.mockResolvedValue(insertedRow(RouteType.Ors));

      await service.create({
        name: 'Drive twice',
        segments: [
          { mode: SegmentMode.Ors, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
          { mode: SegmentMode.Ors, geometry: { type: 'LineString', coordinates: [[1, 1], [2, 2]] } },
        ],
      });

      expect(ors.getDrivingRoute).toHaveBeenCalledTimes(2);
      const params = insertParams();
      expect(params[2]).toBe(RouteType.Ors);
      expect(JSON.parse(params[4] as string)).toEqual({
        type: 'LineString',
        coordinates: [[0, 0.0001], [1, 1.0001], [1, 0.9999], [2, 2]],
      });
    });

    it.each([
      ['an ORS rejection', new UnprocessableEntityException('Could not find routable point'), 422],
      ['ORS not ready', new ServiceUnavailableException('OpenRouteService is not ready'), 503],
    ])('names the failing segment on %s and keeps the status code', async (_case, orsError, status) => {
      ors.getDrivingRoute.mockRejectedValue(orsError);

      const error: unknown = await service
        .create({
          name: 'Mixed',
          segments: [
            { mode: SegmentMode.Manual, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
            { mode: SegmentMode.Ors, geometry: { type: 'LineString', coordinates: [[1, 1], [2, 2]] } },
          ],
        })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(HttpException);
      const httpError = error as HttpException;
      expect(httpError.getStatus()).toBe(status);
      expect(httpError.getResponse()).toMatchObject({ statusCode: status, message: `segments[1] (ors): ${orsError.message}` });
    });

    it('does not store anything when ORS cannot route a segment', async () => {
      ors.getDrivingRoute.mockRejectedValue(new UnprocessableEntityException('Could not find routable point'));

      await expect(
        service.create({
          name: 'Sea',
          segments: [{ mode: SegmentMode.Ors, geometry: { type: 'LineString', coordinates: [[-6.5, 44], [-5.84, 43.36]] } }],
        }),
      ).rejects.toBeInstanceOf(HttpException);
      expect(postgis.query).not.toHaveBeenCalled();
    });

    it('fails loudly if the INSERT returns no row', async () => {
      postgis.query.mockResolvedValue({ rows: [] });
      await expect(
        service.create({
          name: 'Walk',
          segments: [{ mode: SegmentMode.Manual, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }],
        }),
      ).rejects.toThrow('The route was not stored');
    });
  });

  describe('findAll', () => {
    it('selects metadata only, newest first, and maps it to summaries', async () => {
      const createdAt2 = new Date('2026-11-19T11:00:00Z');
      routeRepository.find.mockResolvedValue([
        { id: 2, name: 'Drive', description: null, type: RouteType.Ors, createdAt: createdAt2 },
        { id: 1, name: 'Walk', description: 'Estuary', type: RouteType.Random, createdAt },
      ]);

      const result = await service.findAll();

      expect(routeRepository.find).toHaveBeenCalledWith({
        select: { id: true, name: true, description: true, type: true, createdAt: true },
        order: { createdAt: 'DESC', id: 'DESC' },
      });
      expect(result).toEqual([
        { id: 2, name: 'Drive', description: null, type: RouteType.Ors, createdAt: createdAt2 },
        { id: 1, name: 'Walk', description: 'Estuary', type: RouteType.Random, createdAt },
      ]);
    });

    it('returns an empty list when there are no routes', async () => {
      routeRepository.find.mockResolvedValue([]);
      await expect(service.findAll()).resolves.toEqual([]);
    });
  });

  describe('findOne', () => {
    it('returns the route as a GeoJSON Feature with metadata and segments in properties', async () => {
      const geometry = { type: 'LineString', coordinates: [[-5.9248, 43.556], [-5.8494, 43.3614]] };
      const segments: StoredSegment[] = [
        { mode: SegmentMode.Ors, geometry: { type: 'LineString', coordinates: [[-5.9248, 43.556], [-5.8494, 43.3614]] }, orsProperties: orsRoute.properties },
      ];
      postgis.query.mockResolvedValue({
        rows: [{ id: 9, name: 'Drive', description: null, type: RouteType.Ors, segments, created_at: createdAt, geometry }],
      });

      const feature = await service.findOne(9);

      const [sql, params] = postgis.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('ST_AsGeoJSON(geom, 6)');
      expect(params).toEqual([9]);
      expect(feature).toEqual({
        type: 'Feature',
        id: 9,
        geometry,
        properties: { name: 'Drive', description: null, type: RouteType.Ors, segments, createdAt },
      });
    });

    it('throws 404 when the route does not exist', async () => {
      postgis.query.mockResolvedValue({ rows: [] });
      await expect(service.findOne(404)).rejects.toThrow(new NotFoundException('Route 404 not found'));
    });

    it.each([0, -1, 2_147_483_648])('throws 404 without querying for the impossible id %d', async (id) => {
      await expect(service.findOne(id)).rejects.toBeInstanceOf(NotFoundException);
      expect(postgis.query).not.toHaveBeenCalled();
    });
  });
});
