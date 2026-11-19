import { Controller, Post, Body } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoutingService } from './routing.service.js';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { RouteSummaryDto } from './dto/route-summary.dto.js';

@ApiTags('routes')
@Controller('routes')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a route from ordered segments',
    description: 'The route type (random, ors, hybrid) is derived from the segment modes.',
  })
  @ApiCreatedResponse({ type: RouteSummaryDto })
  @ApiBadRequestResponse({ description: 'Invalid payload (geometry, coordinates or segment continuity)' })
  create(@Body() createRouteDto: CreateRouteDto): Promise<RouteSummaryDto> {
    return this.routingService.create(createRouteDto);
  }
}
