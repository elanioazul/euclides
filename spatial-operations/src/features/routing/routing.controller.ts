import { Controller, Post, Body } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiGatewayTimeoutResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { RoutingService } from './routing.service.js';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { RouteSummaryDto } from './dto/route-summary.dto.js';
import { CREATE_ROUTE_EXAMPLES } from './dto/create-route.examples.js';

@ApiTags('routes')
@Controller('routes')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a route from ordered segments',
    description:
      'The route type is derived from the segment modes: all manual = random, all ors = ors, mixed = hybrid. ' +
      'ors segments are routed by OpenRouteService (driving-car) and stitched in order with the manual ones.',
  })
  @ApiBody({ type: CreateRouteDto, examples: CREATE_ROUTE_EXAMPLES })
  @ApiCreatedResponse({ type: RouteSummaryDto })
  @ApiBadRequestResponse({ description: 'Invalid payload (geometry, coordinates, waypoint limit or segment continuity)' })
  @ApiUnprocessableEntityResponse({ description: 'OpenRouteService cannot route an ors segment; the message names it, e.g. "segments[1] (ors): ..."' })
  @ApiBadGatewayResponse({ description: 'OpenRouteService is unreachable or failed' })
  @ApiServiceUnavailableResponse({ description: 'OpenRouteService is not ready yet' })
  @ApiGatewayTimeoutResponse({ description: 'OpenRouteService did not answer in time' })
  create(@Body() createRouteDto: CreateRouteDto): Promise<RouteSummaryDto> {
    return this.routingService.create(createRouteDto);
  }
}
