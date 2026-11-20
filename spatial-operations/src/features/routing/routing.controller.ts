import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiGatewayTimeoutResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { RoutingService } from './routing.service.js';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { UpdateRouteDto } from './dto/update-route.dto.js';
import { RouteSummaryDto } from './dto/route-summary.dto.js';
import { RouteFeatureDto } from './dto/route-feature.dto.js';
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

  @Get()
  @ApiOperation({
    summary: 'List all routes (metadata only)',
    description: 'Returns id, name, description, type and createdAt, newest first. Geometry and segments are not included.',
  })
  @ApiOkResponse({ type: RouteSummaryDto, isArray: true })
  findAll(): Promise<RouteSummaryDto[]> {
    return this.routingService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one route as a GeoJSON Feature',
    description: 'The Feature carries the stored geometry (6 decimals) and, in properties, the metadata and original segments.',
  })
  @ApiOkResponse({ type: RouteFeatureDto })
  @ApiBadRequestResponse({ description: 'id is not an integer' })
  @ApiNotFoundResponse({ description: 'No route with this id' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<RouteFeatureDto> {
    return this.routingService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a route',
    description:
      'name and description change only the metadata. segments replaces all segments and rebuilds the route as on create, ' +
      'so geometry and type change too. Fields left out keep their value.',
  })
  @ApiOkResponse({ type: RouteSummaryDto })
  @ApiBadRequestResponse({ description: 'Invalid payload, empty payload or non-integer id' })
  @ApiNotFoundResponse({ description: 'No route with this id' })
  @ApiUnprocessableEntityResponse({ description: 'OpenRouteService cannot route an ors segment; the message names it' })
  @ApiBadGatewayResponse({ description: 'OpenRouteService is unreachable or failed' })
  @ApiServiceUnavailableResponse({ description: 'OpenRouteService is not ready yet' })
  @ApiGatewayTimeoutResponse({ description: 'OpenRouteService did not answer in time' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateRouteDto: UpdateRouteDto): Promise<RouteSummaryDto> {
    return this.routingService.update(id, updateRouteDto);
  }
}
