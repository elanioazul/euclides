import { DataSource } from 'typeorm';
import { PostgisService } from './postgis.service.js';
import { PostgisLoggerService } from '../postgis-logger/postgis-logger.service.js';

describe('PostgisService', () => {
  const pool = {
    query: vi.fn(),
    totalCount: 1,
    idleCount: 1,
    waitingCount: 0,
  };
  const dataSource = { driver: { master: pool } } as unknown as DataSource;
  const logger = {
    setContext: vi.fn(),
    log: vi.fn(),
    logQuery: vi.fn(),
    logPoolStatus: vi.fn(),
    error: vi.fn(),
  } as unknown as PostgisLoggerService;

  let service: PostgisService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PostgisService(dataSource, logger, 'routing');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('runs the query on the DataSource pg pool and logs it', async () => {
    pool.query.mockResolvedValue({ rows: [{ ok: 1 }], rowCount: 1 });

    const result = await service.query('SELECT $1::int AS ok', [1]);

    expect(pool.query).toHaveBeenCalledWith('SELECT $1::int AS ok', [1]);
    expect(result.rows).toEqual([{ ok: 1 }]);
    expect(logger.logQuery).toHaveBeenCalled();
  });

  it('logs and rethrows query errors', async () => {
    pool.query.mockRejectedValue(new Error('boom'));

    await expect(service.query('SELECT 1')).rejects.toThrow('boom');
    expect(logger.error).toHaveBeenCalled();
  });
});
