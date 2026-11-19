import { registerDecorator, ValidationOptions } from 'class-validator';

const isLonLat = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === 'number' &&
  typeof value[1] === 'number' &&
  value[0] >= -180 &&
  value[0] <= 180 &&
  value[1] >= -90 &&
  value[1] <= 90;

// Valid GeoJSON LineString coordinates: at least 2 [lon, lat] positions in WGS84 ranges
export function IsLonLatArray(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isLonLatArray',
      target: target.constructor,
      propertyName: String(propertyName),
      options: {
        message: '$property must be an array of at least 2 [lon, lat] positions (lon -180..180, lat -90..90)',
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown): boolean =>
          Array.isArray(value) && value.length >= 2 && value.every(isLonLat),
      },
    });
  };
}
