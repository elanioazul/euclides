import { Test, TestingModule } from '@nestjs/testing';
import { PostgisLoggerService } from './postgis-logger.service.js';

describe('PostgisLoggerService', () => {
  let service: PostgisLoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PostgisLoggerService],
    }).compile();

    service = module.get<PostgisLoggerService>(PostgisLoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
