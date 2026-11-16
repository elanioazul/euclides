import { Injectable, BadRequestException } from '@nestjs/common';
import { PostgisService } from '../../../core/infrastructure/postgis/postgis.service.js';
import { InjectPostgis } from '../../../core/infrastructure/postgis/postgis.decorator.js';
import { ROUTING_CONNECTION } from '../../../core/infrastructure/postgis/consts/database_constants.js';


@Injectable()
export class SpatialUtilsService {
    constructor(@InjectPostgis(ROUTING_CONNECTION) private readonly postgis: PostgisService) {}

    async checkSchemaExists(schema: string): Promise<boolean> {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
            throw new BadRequestException('Invalid schema name format.');
        }

        const sql = `SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = $1`;
        const res = await this.postgis.query(sql, [schema]);
        return res.rows.length > 0;
    }

    // You can also add your common parsing/validation logic here
    parseAndValidateGeoJson(geojson: any): any {
        if (!geojson) return { type: "FeatureCollection", features: [] };
        if (typeof geojson === "string") {
            try {
                return JSON.parse(geojson);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                throw new Error(`Database delivered corrupted JSON: ${message}`);
            }
        }
        return geojson;
    }

    emptyGeoJsonResponse() {
        return { type: 'FeatureCollection', features: [] };
    }
}