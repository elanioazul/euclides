import { OnModuleInit } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { DataSource } from 'typeorm';
import { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver.js';
import { PostgisLoggerService } from '../postgis-logger/postgis-logger.service.js';

// Not @Injectable: one instance per connection is built by PostgisModule.forRootAsync()
// and injected with @InjectPostgis(<connection name>).
export class PostgisService implements OnModuleInit {
    constructor(
        private readonly dataSource: DataSource,
        private readonly logger: PostgisLoggerService,
        connectionName: string
    ) {
        this.logger.setContext(`PostgisService:${connectionName}`);
    }

    // TypeORM's postgres driver keeps its native pg Pool in `master`, so raw SQL and
    // TypeORM repositories share the same connections.
    private get pool(): Pool {
        return (this.dataSource.driver as PostgresDriver).master as Pool;
    }

    onModuleInit() {
        this.logger.log('PostgreSQL Connection Pool initialized.');
    }

    async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
        const start = Date.now();

        try {
            const result = await this.pool.query<T>(text, params);
            const duration = Date.now() - start;

            // Log the performance and pool health
            this.logger.logQuery(text, duration, result.rowCount || 0);
            this.logger.logPoolStatus({
                total: this.pool.totalCount,
                idle: this.pool.idleCount,
                waiting: this.pool.waitingCount,
            });

            return result;
        } catch (error: unknown) {
            // Type Guard: Check if it's a real Error object
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : '';

            this.logger.error(`Query Failed: ${text} | Message: ${errorMessage}`, errorStack);

            throw error;
        }
    }
}
