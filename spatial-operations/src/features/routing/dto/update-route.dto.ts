import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { RouteSegmentDto } from './route-segment.dto.js';
import { SegmentsAreContinuous } from '../validators/segments-are-continuous.validator.js';
import { SegmentMode } from '../enums/segment-mode.enum.js';

// Every field is optional, but only description accepts null (to clear it).
// name and segments use ValidateIf instead of IsOptional because IsOptional would also let null through.
const isPresent = (_object: object, value: unknown): boolean => value !== undefined;

export class UpdateRouteDto {
  @ApiPropertyOptional({ example: 'Aviles waterfront walk (renamed)', maxLength: 255 })
  @ValidateIf(isPresent)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'null clears the description', example: 'Updated notes' })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    type: [RouteSegmentDto],
    description:
      'Replaces all segments. The route is rebuilt as on create (ORS calls, stitching, simplify), so geometry and type change too.',
    example: [
      { mode: SegmentMode.Manual, geometry: { type: 'LineString', coordinates: [[-5.9275, 43.5578], [-5.9248, 43.556]] } },
      { mode: SegmentMode.Ors, geometry: { type: 'LineString', coordinates: [[-5.9248, 43.556], [-5.8494, 43.3614]] } },
    ],
  })
  @ValidateIf(isPresent)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RouteSegmentDto)
  @SegmentsAreContinuous()
  segments?: RouteSegmentDto[];
}
