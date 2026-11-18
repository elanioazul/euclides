import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { getPostgisServiceToken } from './consts/database_constants.js';
import { PostgisService } from './postgis.service.js';
import { PostgisLoggerModule } from '../postgis-logger/postgis-logger.module.js';
import { PostgisLoggerService } from '../postgis-logger/postgis-logger.service.js';

export interface PostgisConnectionOptions {
  // DataSource name, used by TypeOrmModule.forFeature(..., name) and @InjectPostgis(name)
  name: string;
  // Prefix of the env vars holding the credentials: <prefix>HOST, <prefix>PORT, <prefix>USER,
  // <prefix>PASSWORD, <prefix>NAME. They must be validated in AppModule.
  envPrefix?: string;
}

@Module({})
export class PostgisModule {
  // Registers one connection pool (owned by a named TypeORM DataSource) and a PostgisService on top of it.
  // Call it once per database connection in AppModule.
  static forRootAsync(options: PostgisConnectionOptions): DynamicModule {
    const prefix = options.envPrefix ?? 'DATABASE_';
    const serviceToken = getPostgisServiceToken(options.name);

    return {
      module: PostgisModule,
      global: true,
      imports: [
        PostgisLoggerModule,
        TypeOrmModule.forRootAsync({
          name: options.name, //check https://docs.nestjs.com/data/typeorm#multiple-databases
          inject: [ConfigService],
          // No default schema or search_path: entities declare @Entity({ schema }) and raw SQL
          // names its schema (routing.routes). Unqualified names fall back to Postgres' "$user", public.
          useFactory: (configService: ConfigService): TypeOrmModuleOptions => ({
            type: 'postgres',
            host: configService.getOrThrow<string>(`${prefix}HOST`),
            port: configService.getOrThrow<number>(`${prefix}PORT`),
            username: configService.getOrThrow<string>(`${prefix}USER`),
            password: configService.getOrThrow<string>(`${prefix}PASSWORD`),
            database: configService.getOrThrow<string>(`${prefix}NAME`),
            // Dev only: TypeORM creates/alters entity tables on startup. Replace with migrations later.
            // It never creates schemas, so they must exist (init-db/spatialdb_setup.sql).
            synchronize: true,
            autoLoadEntities: true,
            // `extra` is passed untouched to the underlying pg Pool
            extra: {
              max: 20, // High-concurrency tuning=> Max number of clients in the pool
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 2000,
            },
          }),
        }),
      ],
      providers: [
        {
          provide: serviceToken,
          inject: [getDataSourceToken(options.name), PostgisLoggerService],
          useFactory: (dataSource: DataSource, logger: PostgisLoggerService): PostgisService =>
            new PostgisService(dataSource, logger, options.name),
        },
      ],
      exports: [serviceToken],
    };
  }
}
