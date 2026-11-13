import { Injectable, Inject } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { PG_POOL } from './consts/database_constants.js';
import { PostgisLoggerService } from '../postgis-logger/postgis-logger.service.js';

@Injectable()
export class PostgisService {
    constructor(
        @Inject(PG_POOL) private readonly pool: Pool,
        private readonly logger: PostgisLoggerService
    ) {
        this.logger.setContext('PostgisService');
    }

    onModuleInit() {
        this.logger.log('PostgreSQL Connection Pool initialized.');
    }

    async query(text: string, params?: any[]): Promise<QueryResult> {
        const start = Date.now();

        try {
            const result = await this.pool.query(text, params);
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
