import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { UpdateRouteDto } from './update-route.dto.js';

// Same options as the global ValidationPipe in main.ts
const validatePayload = (payload: object): Promise<ValidationError[]> =>
  validate(plainToInstance(UpdateRouteDto, payload), { whitelist: true, forbidNonWhitelisted: true });

const manual = (coordinates: number[][]) => ({ mode: 'manual', geometry: { type: 'LineString', coordinates } });

describe('UpdateRouteDto', () => {
  it.each([
    ['an empty payload (rejected later by the service)', {}],
    ['a name only', { name: 'Renamed' }],
    ['a description cleared with null', { description: null }],
    ['continuous segments only', { segments: [manual([[0, 0], [1, 1]]), manual([[1, 1], [2, 2]])] }],
  ])('accepts %s', async (_case, payload) => {
    expect(await validatePayload(payload)).toHaveLength(0);
  });

  it.each([
    ['a null name', { name: null }, 'name'],
    ['an empty name', { name: '' }, 'name'],
    ['null segments', { segments: null }, 'segments'],
    ['an empty segment list', { segments: [] }, 'segments'],
    ['discontinuous segments', { segments: [manual([[0, 0], [1, 1]]), manual([[5, 5], [2, 2]])] }, 'segments'],
    ['a client-sent type', { type: 'ors' }, 'type'],
  ])('rejects %s', async (_case, payload, property) => {
    const errors = await validatePayload(payload);
    expect(errors.map((error) => error.property)).toEqual([property]);
  });
});
