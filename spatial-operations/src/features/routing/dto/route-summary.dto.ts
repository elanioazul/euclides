import { ApiProperty } from '@nestjs/swagger';
import { RouteType } from '../enums/route-type.enum.js';

export class RouteSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Aviles waterfront walk' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: 'Two manually drawn stretches along the estuary' })
  description: string | null;

  @ApiProperty({ enum: RouteType, enumName: 'RouteType', example: RouteType.Random })
  type: RouteType;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}
