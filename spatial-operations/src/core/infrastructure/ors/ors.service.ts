import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { Position } from 'geojson';
import { ORS_DRIVING_CAR_GEOJSON_PATH } from './ors.consts.js';
import type { OrsDirectionsResponse, OrsErrorBody, OrsRoute } from './ors.types.js';

@Injectable()
export class OrsService {
  private readonly logger = new Logger(OrsService.name);

  constructor(private readonly http: HttpService) {}

  // Road-snapped driving-car route through the given [lon, lat] waypoints
  async getDrivingRoute(waypoints: Position[]): Promise<OrsRoute> {
    let data: OrsDirectionsResponse;
    try {
      const response = await firstValueFrom(
        this.http.post<OrsDirectionsResponse>(ORS_DRIVING_CAR_GEOJSON_PATH, { coordinates: waypoints }),
      );
      data = response.data;
    } catch (error: unknown) {
      throw this.toHttpException(error);
    }

    const feature = data?.features?.[0];
    if (feature?.geometry?.type !== 'LineString' || !Array.isArray(feature.geometry.coordinates)) {
      throw new BadGatewayException('OpenRouteService returned no route geometry');
    }
    return { geometry: feature.geometry, properties: feature.properties };
  }

  private toHttpException(error: unknown): HttpException {
    if (!isAxiosError<OrsErrorBody>(error)) {
      this.logger.error('Unexpected error calling OpenRouteService', error instanceof Error ? error.stack : undefined);
      return new BadGatewayException('OpenRouteService request failed');
    }

    const status = error.response?.status;
    const orsMessage = this.orsMessageOf(error.response?.data);
    this.logger.warn(`OpenRouteService error: status=${status ?? 'none'} code=${error.code ?? 'none'} ${orsMessage ?? error.message}`);

    if (status === undefined) {
      return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
        ? new GatewayTimeoutException('OpenRouteService did not answer in time')
        : new BadGatewayException('OpenRouteService is unreachable');
    }
    if (status === 503) return new ServiceUnavailableException('OpenRouteService is not ready (graphs may still be loading)');
    // 4xx: the waypoints cannot be routed (no road nearby, distance limit, ...)
    if (status >= 400 && status < 500) return new UnprocessableEntityException(orsMessage ?? 'OpenRouteService rejected the route request');
    return new BadGatewayException(orsMessage ?? `OpenRouteService failed with status ${status}`);
  }

  private orsMessageOf(body: OrsErrorBody | undefined): string | undefined {
    const orsError = body?.error;
    if (typeof orsError === 'string') return orsError;
    return orsError?.message;
  }
}
