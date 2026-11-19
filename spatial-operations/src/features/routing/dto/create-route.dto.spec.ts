import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreateRouteDto } from './create-route.dto.js';

// Same options as the global ValidationPipe in main.ts
const validatePayload = (payload: object): Promise<ValidationError[]> =>
  validate(plainToInstance(CreateRouteDto, payload), { whitelist: true, forbidNonWhitelisted: true });

const messagesOf = (errors: ValidationError[]): string[] =>
  errors.flatMap((error) => [...Object.values(error.constraints ?? {}), ...messagesOf(error.children ?? [])]);

const manual = (coordinates: number[][]) => ({ mode: 'manual', geometry: { type: 'LineString', coordinates } });

describe('CreateRouteDto', () => {
  it('accepts continuous manual segments', async () => {
    const errors = await validatePayload({
      name: 'Walk',
      segments: [manual([[-5.92, 43.55], [-5.91, 43.54]]), manual([[-5.91, 43.54], [-5.9, 43.53]])],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a segment that does not start where the previous one ended', async () => {
    const errors = await validatePayload({
      name: 'Walk',
      segments: [manual([[-5.92, 43.55], [-5.91, 43.54]]), manual([[-5.8, 43.5], [-5.9, 43.53]])],
    });
    expect(messagesOf(errors)).toContain('segments[1] must start at the last position of segments[0]');
  });

  it.each([
    ['a single position', [[-5.92, 43.55]]],
    ['a longitude out of range', [[-190, 43.55], [-5.91, 43.54]]],
    ['a latitude out of range', [[-5.92, 95], [-5.91, 43.54]]],
    ['a 3D position', [[-5.92, 43.55, 10], [-5.91, 43.54, 10]]],
    ['a non-numeric value', [['-5.92', 43.55], [-5.91, 43.54]]],
  ])('rejects coordinates with %s', async (_case, coordinates) => {
    const errors = await validatePayload({ name: 'Walk', segments: [manual(coordinates)] });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts an ors segment with up to 50 waypoints and rejects 51', async () => {
    const waypoints = (count: number) => Array.from({ length: count }, (_v, i) => [-5.9 + i * 0.001, 43.5]);
    const ors = (count: number) => ({ mode: 'ors', geometry: { type: 'LineString', coordinates: waypoints(count) } });

    expect(await validatePayload({ name: 'Drive', segments: [ors(50)] })).toHaveLength(0);
    expect(messagesOf(await validatePayload({ name: 'Drive', segments: [ors(51)] }))).toContain(
      'geometry must have at most 50 waypoints in an ors segment',
    );
  });

  it('does not apply the waypoint limit to manual segments', async () => {
    const coordinates = Array.from({ length: 60 }, (_v, i) => [-5.9 + i * 0.001, 43.5]);
    expect(await validatePayload({ name: 'Walk', segments: [manual(coordinates)] })).toHaveLength(0);
  });

  it('rejects a geometry that is not a LineString', async () => {
    const errors = await validatePayload({
      name: 'Walk',
      segments: [{ mode: 'manual', geometry: { type: 'Point', coordinates: [[-5.92, 43.55], [-5.91, 43.54]] } }],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an unknown segment mode', async () => {
    const errors = await validatePayload({
      name: 'Walk',
      segments: [{ mode: 'teleport', geometry: { type: 'LineString', coordinates: [[-5.92, 43.55], [-5.91, 43.54]] } }],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an empty segment list, a missing name and a client-sent type', async () => {
    const errors = await validatePayload({ type: 'random', segments: [] });
    expect(errors.map((error) => error.property).sort()).toEqual(['name', 'segments', 'type']);
  });
});
