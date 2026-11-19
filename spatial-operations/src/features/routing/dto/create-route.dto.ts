import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { RouteSegmentDto } from './route-segment.dto.js';
import { SegmentsAreContinuous } from '../validators/segments-are-continuous.validator.js';
import { SegmentMode } from '../enums/segment-mode.enum.js';

export class CreateRouteDto {
  @ApiProperty({ example: 'Aviles waterfront walk', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Two manually drawn stretches along the estuary' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: [RouteSegmentDto],
    description: 'Ordered segments. Each segment must start at the last position of the previous one.',
    example: [
      {
        mode: SegmentMode.Manual,
        geometry: { type: 'LineString', coordinates: [[-5.9246, 43.5560], [-5.9180, 43.5512]] },
      },
      {
        mode: SegmentMode.Manual,
        geometry: { type: 'LineString', coordinates: [[-5.9180, 43.5512], [-5.9105, 43.5498], [-5.9032, 43.5530]] },
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RouteSegmentDto)
  @SegmentsAreContinuous()
  segments: RouteSegmentDto[];
}
