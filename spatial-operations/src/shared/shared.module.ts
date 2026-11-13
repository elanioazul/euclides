import { Module } from '@nestjs/common';
import { SpatialUtilsService } from './services/spatial-utils/spatial-utils.service.js';

@Module({
  providers: [SpatialUtilsService],
  exports: [SpatialUtilsService],
})
export class SharedModule {}
