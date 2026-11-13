import { Module } from '@nestjs/common';
import { PostgisLoggerService } from './postgis-logger.service.js';

@Module({
  providers: [PostgisLoggerService],
  exports: [PostgisLoggerService],
})
export class PostgisLoggerModule {}
