import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import type { Position } from 'geojson';
import { samePosition } from '../route-geometry.builder.js';

const coordinatesOf = (segment: unknown): Position[] | undefined => {
  if (typeof segment !== 'object' || segment === null || !('geometry' in segment)) return undefined;
  const { geometry } = segment;
  if (typeof geometry !== 'object' || geometry === null || !('coordinates' in geometry)) return undefined;
  return Array.isArray(geometry.coordinates) ? (geometry.coordinates as Position[]) : undefined;
};

// Index of the first segment that does not start at the previous segment's last position, or -1.
// Malformed segments are skipped here: their own nested validators report them.
const findDiscontinuity = (segments: unknown): number => {
  if (!Array.isArray(segments)) return -1;
  for (let i = 1; i < segments.length; i++) {
    const previous = coordinatesOf(segments[i - 1])?.at(-1);
    const current = coordinatesOf(segments[i])?.[0];
    if (Array.isArray(previous) && Array.isArray(current) && !samePosition(previous, current)) return i;
  }
  return -1;
};

export function SegmentsAreContinuous(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'segmentsAreContinuous',
      target: target.constructor,
      propertyName: String(propertyName),
      options: {
        message: (args: ValidationArguments): string => {
          const index = findDiscontinuity(args.value);
          return `${args.property}[${index}] must start at the last position of ${args.property}[${index - 1}]`;
        },
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown): boolean => findDiscontinuity(value) === -1,
      },
    });
  };
}
