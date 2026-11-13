import { ConsoleLogger, Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT }) // Transient ensures each module gets its own context name
export class PostgisLoggerService extends ConsoleLogger {
  
  logQuery(query: string, duration: number, rows: number) {
    const message = `[Query] ${duration}ms | Rows: ${rows} | SQL: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`;
    
    if (duration > 500) {
      this.warn(`🐢 SLOW: ${message}`);
    } else {
      this.log(`⚡ ${message}`);
    }
  }

  logPoolStatus(stats: { total: number; idle: number; waiting: number }) {
    this.debug(`[Pool] Total: ${stats.total} | Idle: ${stats.idle} | Waiting: ${stats.waiting}`);
  }
}