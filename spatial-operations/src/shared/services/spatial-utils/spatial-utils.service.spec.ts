import { Test, TestingModule } from '@nestjs/testing';
import { SpatialUtilsService } from './spatial-utils.service.js';

describe('SpatialUtilsService', () => {
  let service: SpatialUtilsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SpatialUtilsService],
    }).compile();

    service = module.get<SpatialUtilsService>(SpatialUtilsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
