import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LineStringDto } from '../../../shared/dto/line-string.dto.js';
import { RouteType } from '../enums/route-type.enum.js';
import { RouteSegmentDto } from './route-segment.dto.js';
import type { OrsRouteProperties } from '../../../core/infrastructure/ors/ors.types.js';

// A stored segment: the original request segment, plus the ORS response properties on ors segments
export class StoredSegmentDto extends RouteSegmentDto {
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'ors segments only: features[0].properties of the OpenRouteService response (summary, segments, way_points)',
  })
  orsProperties?: OrsRouteProperties;
}

export class RouteFeaturePropertiesDto {
  @ApiProperty({ example: 'Aviles to Oviedo' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: 'Driving route, vertices are waypoints' })
  description: string | null;

  @ApiProperty({ enum: RouteType, enumName: 'RouteType', example: RouteType.Ors })
  type: RouteType;

  @ApiProperty({ type: StoredSegmentDto, isArray: true })
  segments: StoredSegmentDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

// GeoJSON Feature (RFC 7946) ready for L.geoJSON: the stored, simplified route geometry
export class RouteFeatureDto {
  @ApiProperty({ enum: ['Feature'], example: 'Feature' })
  type: 'Feature';

  @ApiProperty({ example: 9 })
  id: number;

  @ApiProperty({ type: LineStringDto, description: 'Stored route geometry, EPSG:4326, 6 decimals' })
  geometry: LineStringDto;

  @ApiProperty({ type: RouteFeaturePropertiesDto })
  properties: RouteFeaturePropertiesDto;
}
