import { Test, TestingModule } from '@nestjs/testing';
import { SpatialUtilsService } from './spatial-utils.service.js';
import {
  SPATIALDB_CONNECTION,
  getPostgisServiceToken,
} from '../../../core/infrastructure/postgis/consts/database_constants.js';

describe('SpatialUtilsService', () => {
  let service: SpatialUtilsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpatialUtilsService,
        { provide: getPostgisServiceToken(SPATIALDB_CONNECTION), useValue: {} },
      ],
    }).compile();

    service = module.get<SpatialUtilsService>(SpatialUtilsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
