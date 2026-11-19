import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsEnum, ValidateNested } from 'class-validator';
import { LineStringDto } from '../../../shared/dto/line-string.dto.js';
import { SegmentMode } from '../enums/segment-mode.enum.js';
import { OrsWaypointsWithinLimit } from '../validators/ors-waypoints-within-limit.validator.js';
import { ORS_MAX_WAYPOINTS } from '../../../core/infrastructure/ors/ors.consts.js';

export class RouteSegmentDto {
  @ApiProperty({
    enum: SegmentMode,
    enumName: 'SegmentMode',
    example: SegmentMode.Manual,
    description:
      'manual: the geometry is the line drawn by the user, stored as given. ' +
      `ors: the geometry vertices are waypoints (2 to ${ORS_MAX_WAYPOINTS}); OpenRouteService (driving-car) returns the road path through them.`,
  })
  @IsEnum(SegmentMode)
  mode: SegmentMode;

  @ApiProperty({ type: LineStringDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LineStringDto)
  @OrsWaypointsWithinLimit()
  geometry: LineStringDto;
}
