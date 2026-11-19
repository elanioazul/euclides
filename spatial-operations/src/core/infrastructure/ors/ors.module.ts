import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { OrsService } from './ors.service.js';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        baseURL: configService.getOrThrow<string>('ORS_BASE_URL'),
        timeout: configService.getOrThrow<number>('ORS_REQUEST_TIMEOUT_MS'),
      }),
    }),
  ],
  providers: [OrsService],
  exports: [OrsService],
})
export class OrsModule {}
