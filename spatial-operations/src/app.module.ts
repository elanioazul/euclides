import { Module } from '@nestjs/common';
import { PostgisModule } from './core/infrastructure/postgis/postgis.module.js';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from './shared/shared.module.js';
import { RoutingModule } from './features/routing/routing.module.js';
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
        DATABASE_SCHEMA: Joi.string().default('routing'),
      }),
    }),
    PostgisModule,
    SharedModule,
    RoutingModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
