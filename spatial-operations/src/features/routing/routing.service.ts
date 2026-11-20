import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { LineString, Position } from 'geojson';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { UpdateRouteDto } from './dto/update-route.dto.js';
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

// What create and update store for a set of segments
interface BuiltRoute {
  type: RouteType;
  segments: StoredSegment[];
  geometry: LineString;
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

// Also resets the id sequence, so the next route gets id 1
const TRUNCATE_ROUTES_SQL = 'TRUNCATE TABLE routing.routes RESTART IDENTITY';

// Simplified in metres (METRIC_SRID) and stored back in EPSG:4326.
// preserveCollapsed = true keeps very short routes from collapsing to nothing.
// A NULL GeoJSON parameter gives a NULL geometry (used by UPDATE to keep the current one).
const simplifiedGeomSql = (geoJsonParam: string, toleranceParam: string): string => `
    ST_Transform(
      ST_Simplify(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(${geoJsonParam}::text), 4326), ${METRIC_SRID}), ${toleranceParam}::float8, true),
      4326
    )`;

const INSERT_ROUTE_SQL = `
  INSERT INTO routing.routes (name, description, type, segments, geom)
  VALUES ($1, $2, $3, $4::jsonb, ${simplifiedGeomSql('$5', '$6')})
  RETURNING id, name, description, type, created_at`;

// NULL parameters keep the current value; $3 says whether description was sent (null clears it).
// Raw SQL does not trigger TypeORM's @UpdateDateColumn, so updated_at is set here.
const UPDATE_ROUTE_SQL = `
  UPDATE routing.routes SET
    name = COALESCE($2::varchar, name),
    description = CASE WHEN $3::boolean THEN $4::text ELSE description END,
    type = COALESCE($5::varchar, type),
    segments = COALESCE($6::jsonb, segments),
    geom = COALESCE(${simplifiedGeomSql('$7', '$8')}, geom),
    updated_at = now()
  WHERE id = $1
  RETURNING id, name, description, type, created_at`;

const toSummary = (row: RouteSummaryRow): RouteSummaryDto => ({
  id: row.id,
  name: row.name,
  description: row.description,
  type: row.type,
  createdAt: row.created_at,
});

@Injectable()
export class RoutingService {
  // Both share the spatialdb connection pool: repository for CRUD, postgis for raw PostGIS SQL
  constructor(
    @InjectRepository(Route, SPATIALDB_CONNECTION) private readonly routeRepository: Repository<Route>,
    @InjectPostgis(SPATIALDB_CONNECTION) private readonly postgis: PostgisService,
    private readonly ors: OrsService,
  ) {}

  async create(createRouteDto: CreateRouteDto): Promise<RouteSummaryDto> {
    const route = await this.buildRoute(createRouteDto.segments);

    const result = await this.postgis.query<RouteSummaryRow>(INSERT_ROUTE_SQL, [
      createRouteDto.name,
      createRouteDto.description ?? null,
      route.type,
      JSON.stringify(route.segments),
      JSON.stringify(route.geometry),
      SIMPLIFY_TOLERANCE_M,
    ]);

    const row = result.rows[0];
    if (!row) throw new InternalServerErrorException('The route was not stored');
    return toSummary(row);
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

  async update(id: number, updateRouteDto: UpdateRouteDto): Promise<RouteSummaryDto> {
    if (id < 1 || id > MAX_ROUTE_ID) throw new NotFoundException(`Route ${id} not found`);
    const { name, description, segments } = updateRouteDto;
    if (name === undefined && description === undefined && segments === undefined) {
      throw new BadRequestException('Nothing to update: send name, description and/or segments');
    }

    const route = segments === undefined ? undefined : await this.buildRoute(segments);

    const result = await this.postgis.query<RouteSummaryRow>(UPDATE_ROUTE_SQL, [
      id,
      name ?? null,
      description !== undefined,
      description ?? null,
      route?.type ?? null,
      route ? JSON.stringify(route.segments) : null,
      route ? JSON.stringify(route.geometry) : null,
      SIMPLIFY_TOLERANCE_M,
    ]);

    const row = result.rows[0];
    if (!row) throw new NotFoundException(`Route ${id} not found`);
    return toSummary(row);
  }

  async remove(id: number): Promise<void> {
    if (id < 1 || id > MAX_ROUTE_ID) throw new NotFoundException(`Route ${id} not found`);
    const result = await this.routeRepository.delete(id);
    if (!result.affected) throw new NotFoundException(`Route ${id} not found`);
  }

  async removeAll(): Promise<void> {
    await this.postgis.query(TRUNCATE_ROUTES_SQL);
  }

  // Shared by create and update: route the ors segments, stitch all legs and derive the type
  private async buildRoute(segmentDtos: RouteSegmentDto[]): Promise<BuiltRoute> {
    // ORS legs are requested in parallel; Promise.all keeps the segment order for stitching
    const resolved = await Promise.all(segmentDtos.map((segment, index) => this.resolveSegment(segment, index)));
    const segments = resolved.map((item) => item.stored);
    return {
      type: deriveRouteType(segments.map((segment) => segment.mode)),
      segments,
      geometry: stitchLegs(resolved.map((item) => item.leg)),
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
