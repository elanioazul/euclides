import { Module } from '@nestjs/common';
import { PostgisModule } from './core/infrastructure/postgis/postgis.module.js';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from './shared/shared.module.js';
import { RoutingModule } from './features/routing/routing.module.js';
import { SPATIALDB_CONNECTION } from './core/infrastructure/postgis/consts/database_constants.js';
import Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_HOST: Joi.string().required(),
        DATABASE_PORT: Joi.number().default(5432),
        DATABASE_USER: Joi.string().required(),
        DATABASE_PASSWORD: Joi.string().required(),
        DATABASE_NAME: Joi.string().required(),
        ORS_BASE_URL: Joi.string().uri().required(),
        ORS_REQUEST_TIMEOUT_MS: Joi.number().integer().positive().required(),
      }),
    }),
    // Reads the DATABASE_* env vars above. Add one call per extra connection (with its own envPrefix).
    PostgisModule.forRootAsync({ name: SPATIALDB_CONNECTION }),
    SharedModule,
    RoutingModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
