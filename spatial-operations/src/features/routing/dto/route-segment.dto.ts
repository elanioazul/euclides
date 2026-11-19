import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsEnum, ValidateNested } from 'class-validator';
import { LineStringDto } from '../../../shared/dto/line-string.dto.js';
import { SegmentMode } from '../enums/segment-mode.enum.js';

export class RouteSegmentDto {
  @ApiProperty({
    enum: SegmentMode,
    enumName: 'SegmentMode',
    example: SegmentMode.Manual,
    description: 'manual: the geometry is the line drawn by the user, stored as given',
  })
  @IsEnum(SegmentMode)
  mode: SegmentMode;

  @ApiProperty({ type: LineStringDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LineStringDto)
  geometry: LineStringDto;
}
