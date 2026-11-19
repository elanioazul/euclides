import { HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { LineString, Position } from 'geojson';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { RouteSegmentDto } from './dto/route-segment.dto.js';
import { RouteSummaryDto } from './dto/route-summary.dto.js';
import { RouteFeatureDto } from './dto/route-feature.dto.js';
import { Route } from './entities/routing.entity.js';
import { RouteType } from './enums/route-type.enum.js';
import { SegmentMode } from './enums/segment-mode.enum.js';
import type { StoredSegment } from './interfaces/stored-segment.interface.js';
import { deriveRouteType, stitchLegs } from './route-geometry.builder.js';
import { METRIC_SRID, SIMPLIFY_TOLERANCE_M } from './consts/routing.consts.js';
import { SPATIALDB_CONNECTION } from '../../core/infrastructure/postgis/consts/database_constants.js';
import { InjectPostgis } from '../../core/infrastructure/postgis/postgis.decorator.js';
import { PostgisService } from '../../core/infrastructure/postgis/postgis.service.js';
import { OrsService } from '../../core/infrastructure/ors/ors.service.js';
import type { OrsRoute } from '../../core/infrastructure/ors/ors.types.js';

interface ResolvedSegment {
  stored: StoredSegment;
  // Coordinates that make up this stretch of the final route
  leg: Position[];
}

interface RouteSummaryRow {
  id: number;
  name: string;
  description: string | null;
  type: RouteType;
  created_at: Date;
}

interface RouteFeatureRow extends RouteSummaryRow {
  segments: StoredSegment[];
  geometry: LineString;
}

// Largest value of the integer id column: bigger ids cannot exist and would make Postgres fail
const MAX_ROUTE_ID = 2_147_483_647;

// pg parses json/jsonb columns, so geometry and segments arrive as objects
const SELECT_ROUTE_FEATURE_SQL = `
  SELECT id, name, description, type, segments, created_at, ST_AsGeoJSON(geom, 6)::json AS geometry
  FROM routing.routes
  WHERE id = $1`;

// Simplified in metres (METRIC_SRID) and stored back in EPSG:4326.
// preserveCollapsed = true keeps very short routes from collapsing to nothing.
const INSERT_ROUTE_SQL = `
  INSERT INTO routing.routes (name, description, type, segments, geom)
  VALUES (
    $1, $2, $3, $4::jsonb,
    ST_Transform(
      ST_Simplify(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($5::text), 4326), ${METRIC_SRID}), $6::float8, true),
      4326
    )
  )
  RETURNING id, name, description, type, created_at`;

@Injectable()
export class RoutingService {
  // Both share the spatialdb connection pool: repository for CRUD, postgis for raw PostGIS SQL
  constructor(
    @InjectRepository(Route, SPATIALDB_CONNECTION) private readonly routeRepository: Repository<Route>,
    @InjectPostgis(SPATIALDB_CONNECTION) private readonly postgis: PostgisService,
    private readonly ors: OrsService,
  ) {}

  async create(createRouteDto: CreateRouteDto): Promise<RouteSummaryDto> {
    // ORS legs are requested in parallel; Promise.all keeps the segment order for stitching
    const resolved = await Promise.all(createRouteDto.segments.map((segment, index) => this.resolveSegment(segment, index)));
    const segments = resolved.map((item) => item.stored);
    const geometry = stitchLegs(resolved.map((item) => item.leg));
    const type = deriveRouteType(segments.map((segment) => segment.mode));

    const result = await this.postgis.query<RouteSummaryRow>(INSERT_ROUTE_SQL, [
      createRouteDto.name,
      createRouteDto.description ?? null,
      type,
      JSON.stringify(segments),
      JSON.stringify(geometry),
      SIMPLIFY_TOLERANCE_M,
    ]);

    const row = result.rows[0];
    if (!row) throw new InternalServerErrorException('The route was not stored');
    return { id: row.id, name: row.name, description: row.description, type: row.type, createdAt: row.created_at };
  }

  // Metadata only (no geometry, no segments), newest first: feeds the client's route list
  async findAll(): Promise<RouteSummaryDto[]> {
    const routes = await this.routeRepository.find({
      select: { id: true, name: true, description: true, type: true, createdAt: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return routes.map(({ id, name, description, type, createdAt }) => ({ id, name, description, type, createdAt }));
  }

  async findOne(id: number): Promise<RouteFeatureDto> {
    if (id < 1 || id > MAX_ROUTE_ID) throw new NotFoundException(`Route ${id} not found`);

    const result = await this.postgis.query<RouteFeatureRow>(SELECT_ROUTE_FEATURE_SQL, [id]);
    const row = result.rows[0];
    if (!row) throw new NotFoundException(`Route ${id} not found`);
    return {
      type: 'Feature',
      id: row.id,
      geometry: row.geometry,
      properties: {
        name: row.name,
        description: row.description,
        type: row.type,
        segments: row.segments,
        createdAt: row.created_at,
      },
    };
  }

  private async resolveSegment(segment: RouteSegmentDto, index: number): Promise<ResolvedSegment> {
    const stored: StoredSegment = { mode: segment.mode, geometry: segment.geometry };
    switch (segment.mode) {
      case SegmentMode.Manual:
        return { stored, leg: segment.geometry.coordinates };
      case SegmentMode.Ors: {
        const route = await this.routeOrsSegment(segment, index);
        return { stored: { ...stored, orsProperties: route.properties }, leg: route.geometry.coordinates };
      }
    }
  }

  // Keeps the ORS status code but names the failing segment, e.g. "segments[1] (ors): Could not find routable point..."
  private async routeOrsSegment(segment: RouteSegmentDto, index: number): Promise<OrsRoute> {
    try {
      return await this.ors.getDrivingRoute(segment.geometry.coordinates);
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
      const response = error.getResponse();
      const body = typeof response === 'object' ? response : { message: response };
      throw new HttpException(
        { ...body, message: `segments[${index}] (${segment.mode}): ${error.message}` },
        error.getStatus(),
        { cause: error },
      );
    }
  }
}
