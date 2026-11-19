import { ApiProperty } from '@nestjs/swagger';
import { Equals } from 'class-validator';
import type { LineString, Position } from 'geojson';
import { IsLonLatArray } from '../validators/is-lon-lat-array.validator.js';

// GeoJSON LineString geometry (RFC 7946), EPSG:4326
export class LineStringDto implements LineString {
  @ApiProperty({ enum: ['LineString'], example: 'LineString' })
  @Equals('LineString')
  type: 'LineString';

  @ApiProperty({
    description: 'At least 2 [lon, lat] positions in EPSG:4326',
    type: 'array',
    items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
    example: [
      [-5.9246, 43.5560],
      [-5.9180, 43.5512],
    ],
  })
  @IsLonLatArray()
  coordinates: Position[];
}
