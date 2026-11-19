import {
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { of, throwError } from 'rxjs';
import { OrsService } from './ors.service.js';
import { ORS_DRIVING_CAR_GEOJSON_PATH } from './ors.consts.js';
import type { OrsDirectionsResponse } from './ors.types.js';

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

const axiosResponse = <T>(status: number, data: T): AxiosResponse<T> => ({
  status,
  statusText: '',
  data,
  headers: {},
  config,
});

const httpError = (status: number, data: unknown): AxiosError =>
  new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', config, {}, axiosResponse(status, data));

const networkError = (code: string): AxiosError => new AxiosError('network', code, config, {});

describe('OrsService', () => {
  const http = { post: vi.fn() };
  const service = new OrsService(http as unknown as HttpService);
  const waypoints = [[-5.92, 43.55], [-5.84, 43.36]];

  beforeEach(() => vi.clearAllMocks());

  it('posts the waypoints to the driving-car geojson endpoint and returns the first feature', async () => {
    const body: OrsDirectionsResponse = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[-5.92, 43.55], [-5.88, 43.45], [-5.84, 43.36]] },
          properties: { summary: { distance: 25000, duration: 1500 }, segments: [], way_points: [0, 2] },
        },
      ],
    };
    http.post.mockReturnValue(of(axiosResponse(200, body)));

    const route = await service.getDrivingRoute(waypoints);

    expect(http.post).toHaveBeenCalledWith(ORS_DRIVING_CAR_GEOJSON_PATH, { coordinates: waypoints });
    expect(route.geometry.coordinates).toHaveLength(3);
    expect(route.properties.summary.distance).toBe(25000);
  });

  it('rejects a response without a LineString feature as 502', async () => {
    http.post.mockReturnValue(of(axiosResponse(200, { type: 'FeatureCollection', features: [] })));
    await expect(service.getDrivingRoute(waypoints)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('maps an ORS 4xx to 422 with the ORS message', async () => {
    const message = 'Could not find routable point within a radius of 350.0 meters of specified coordinate 0';
    http.post.mockReturnValue(throwError(() => httpError(404, { error: { code: 2010, message } })));

    const error: unknown = await service.getDrivingRoute(waypoints).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect((error as UnprocessableEntityException).message).toBe(message);
  });

  it.each([
    ['ORS 503 (not ready)', () => httpError(503, {}), ServiceUnavailableException],
    ['ORS 500', () => httpError(500, { error: 'boom' }), BadGatewayException],
    ['a timeout', () => networkError('ECONNABORTED'), GatewayTimeoutException],
    ['a refused connection', () => networkError('ECONNREFUSED'), BadGatewayException],
  ])('maps %s', async (_case, makeError, expected) => {
    http.post.mockReturnValue(throwError(makeError));
    await expect(service.getDrivingRoute(waypoints)).rejects.toBeInstanceOf(expected);
  });
});
