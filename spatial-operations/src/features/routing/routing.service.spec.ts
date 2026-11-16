import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoutingService } from './routing.service.js';
import { Route } from './entities/routing.entity.js';
import {
  SPATIALDB_CONNECTION,
  getPostgisServiceToken,
} from '../../core/infrastructure/postgis/consts/database_constants.js';

describe('RoutingService', () => {
  let service: RoutingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutingService,
        { provide: getRepositoryToken(Route, SPATIALDB_CONNECTION), useValue: {} },
        { provide: getPostgisServiceToken(SPATIALDB_CONNECTION), useValue: {} },
      ],
    }).compile();

    service = module.get<RoutingService>(RoutingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
