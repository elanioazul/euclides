import { Module, Global, OnApplicationShutdown, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL } from './consts/database_constants.js';
import { PostgisService } from './postgis.service.js';
import { PostgisLoggerModule } from '../postgis-logger/postgis-logger.module.js';

@Global()
@Module({
  imports: [
    PostgisLoggerModule
  ],
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new Pool({
          host: configService.get<string>('DATABASE_HOST'),
          port: configService.get<number>('DATABASE_PORT'),
          user: configService.get<string>('DATABASE_USER'),
          password: configService.get<string>('DATABASE_PASSWORD'),
          database: configService.get<string>('DATABASE_NAME'),
          // Use the PostgreSQL command-line option to set the search path natively, 
          // since this is native pg PoolConfig interface and it does not have a schema property.
          // That configuration option belongs to ORMs like TypeORM
          // Any raw SQL queries executed through this pool will now target your specified schema by default.
          options: `-c search_path=routing,public`, //routing is the schema to interact with
          max: 20, // High-concurrency tuning=> Max number of clients in the pool
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        });
      },
    },
    PostgisService,
  ],
  exports: [PG_POOL, PostgisService],
})
export class PostgisModule implements OnApplicationShutdown {
  // Use @Inject(PG_POOL) so Nest knows which provider to put here
  constructor(@Inject(PG_POOL) private readonly pool: Pool) { }

  async onApplicationShutdown() {
    console.log('Closing PostGIS Pool connections...');
    await this.pool.end();
  }
}
