import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { ORS_MAX_WAYPOINTS } from '../../../core/infrastructure/ors/ors.consts.js';
import { SegmentMode } from '../enums/segment-mode.enum.js';

const waypointCountOf = (geometry: unknown): number | undefined => {
  if (typeof geometry !== 'object' || geometry === null || !('coordinates' in geometry)) return undefined;
  return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : undefined;
};

// Applied to RouteSegmentDto.geometry: an ors segment may not exceed the ORS waypoint limit
export function OrsWaypointsWithinLimit(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'orsWaypointsWithinLimit',
      target: target.constructor,
      propertyName: String(propertyName),
      options: {
        message: `$property must have at most ${ORS_MAX_WAYPOINTS} waypoints in an ors segment`,
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown, args: ValidationArguments): boolean => {
          const segment = args.object as { mode?: unknown };
          if (segment.mode !== SegmentMode.Ors) return true;
          const count = waypointCountOf(value);
          return count === undefined || count <= ORS_MAX_WAYPOINTS;
        },
      },
    });
  };
}
