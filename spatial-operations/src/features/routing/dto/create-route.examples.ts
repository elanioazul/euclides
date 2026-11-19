import type { ExamplesObject } from '@nestjs/swagger';

// Request examples shown in Swagger for POST /api/routes (Aviles - Gijon - Oviedo ORS extract)
export const CREATE_ROUTE_EXAMPLES: ExamplesObject = {
  random: {
    summary: 'random: manual segments only',
    value: {
      name: 'Aviles walk',
      description: 'Hand-drawn route',
      segments: [
        { mode: 'manual', geometry: { type: 'LineString', coordinates: [[-5.9248, 43.556], [-5.9205, 43.5541]] } },
        { mode: 'manual', geometry: { type: 'LineString', coordinates: [[-5.9205, 43.5541], [-5.9152, 43.5512]] } },
      ],
    },
  },
  ors: {
    summary: 'ors: road route through OpenRouteService',
    value: {
      name: 'Aviles to Oviedo',
      description: 'Driving route, vertices are waypoints',
      segments: [
        { mode: 'ors', geometry: { type: 'LineString', coordinates: [[-5.9248, 43.556], [-5.8494, 43.3614]] } },
      ],
    },
  },
  hybrid: {
    summary: 'hybrid: manual, ors and manual segments',
    value: {
      name: 'Aviles to Gijon',
      description: 'Walk to the car, drive, walk to the destination',
      segments: [
        { mode: 'manual', geometry: { type: 'LineString', coordinates: [[-5.9275, 43.5578], [-5.9248, 43.556]] } },
        { mode: 'ors', geometry: { type: 'LineString', coordinates: [[-5.9248, 43.556], [-5.6615, 43.5357]] } },
        { mode: 'manual', geometry: { type: 'LineString', coordinates: [[-5.6615, 43.5357], [-5.6589, 43.5385]] } },
      ],
    },
  },
};
