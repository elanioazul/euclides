import { PostgisModule } from './postgis.module.js';
import { getPostgisServiceToken } from './consts/database_constants.js';

describe('PostgisModule', () => {
  it('exports a PostgisService token per named connection', () => {
    const routing = PostgisModule.forRootAsync({ name: 'routing' });
    const other = PostgisModule.forRootAsync({ name: 'other', envPrefix: 'OTHER_DB_' });

    expect(routing.global).toBe(true);
    expect(routing.exports).toEqual([getPostgisServiceToken('routing')]);
    expect(other.exports).toEqual([getPostgisServiceToken('other')]);
  });
});
