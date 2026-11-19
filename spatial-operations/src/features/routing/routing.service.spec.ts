import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoutingService } from './routing.service.js';
import { Route } from './entities/routing.entity.js';
import { SegmentMode } from './enums/segment-mode.enum.js';
import { RouteType } from './enums/route-type.enum.js';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { SIMPLIFY_TOLERANCE_M } from './consts/routing.consts.js';
import {
  SPATIALDB_CONNECTION,
  getPostgisServiceToken,
} from '../../core/infrastructure/postgis/consts/database_constants.js';

describe('RoutingService', () => {
  const postgis = { query: vi.fn() };
  let service: RoutingService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutingService,
        { provide: getRepositoryToken(Route, SPATIALDB_CONNECTION), useValue: {} },
        { provide: getPostgisServiceToken(SPATIALDB_CONNECTION), useValue: postgis },
      ],
    }).compile();

    service = module.get<RoutingService>(RoutingService);
  });

  describe('create', () => {
    const dto: CreateRouteDto = {
      name: 'Walk',
      segments: [
        { mode: SegmentMode.Manual, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
        { mode: SegmentMode.Manual, geometry: { type: 'LineString', coordinates: [[1, 1], [2, 2]] } },
      ],
    };

    it('stores the stitched geometry, derived type and original segments', async () => {
      const createdAt = new Date('2026-11-19T10:00:00Z');
      postgis.query.mockResolvedValue({
        rows: [{ id: 7, name: 'Walk', description: null, type: RouteType.Random, created_at: createdAt }],
      });

      const result = await service.create(dto);

      const [sql, params] = postgis.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO routing.routes');
      expect(sql).toContain('ST_Simplify');
      expect(params).toEqual([
        'Walk',
        null,
        RouteType.Random,
        JSON.stringify(dto.segments),
        JSON.stringify({ type: 'LineString', coordinates: [[0, 0], [1, 1], [2, 2]] }),
        SIMPLIFY_TOLERANCE_M,
      ]);
      expect(result).toEqual({ id: 7, name: 'Walk', description: null, type: RouteType.Random, createdAt });
    });

    it('fails loudly if the INSERT returns no row', async () => {
      postgis.query.mockResolvedValue({ rows: [] });
      await expect(service.create(dto)).rejects.toThrow('The route was not stored');
    });
  });
});
