import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutingService } from './routing.service.js';
import { RoutingController } from './routing.controller.js';
import { Route } from './entities/routing.entity.js';
import { SPATIALDB_CONNECTION } from '../../core/infrastructure/postgis/consts/database_constants.js';

@Module({
  imports: [TypeOrmModule.forFeature([Route], SPATIALDB_CONNECTION)],
  controllers: [RoutingController],
  providers: [RoutingService],
})
export class RoutingModule {}
