import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { RouteSummaryDto } from './dto/route-summary.dto.js';
import { Route } from './entities/routing.entity.js';
import { RouteType } from './enums/route-type.enum.js';
import type { StoredSegment } from './interfaces/stored-segment.interface.js';
import { deriveRouteType, stitchLegs } from './route-geometry.builder.js';
import { METRIC_SRID, SIMPLIFY_TOLERANCE_M } from './consts/routing.consts.js';
import { SPATIALDB_CONNECTION } from '../../core/infrastructure/postgis/consts/database_constants.js';
import { InjectPostgis } from '../../core/infrastructure/postgis/postgis.decorator.js';
import { PostgisService } from '../../core/infrastructure/postgis/postgis.service.js';

interface RouteSummaryRow {
  id: number;
  name: string;
  description: string | null;
  type: RouteType;
  created_at: Date;
}

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
  ) {}

  async create(createRouteDto: CreateRouteDto): Promise<RouteSummaryDto> {
    const segments: StoredSegment[] = createRouteDto.segments;
    const geometry = stitchLegs(segments.map((segment) => segment.geometry.coordinates));
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
}
