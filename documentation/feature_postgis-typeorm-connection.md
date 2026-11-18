# feature/postgis-typeorm-connections

How the NestJS API (`spatial-operations`) connects to PostGIS: one connection pool per database, shared by TypeORM repositories and raw PostGIS SQL.

Merged into `master` in `bf1bf9a`. Diagrams: [feature_postgis-typeorm-connection_diagram.md](./feature_postgis-typeorm-connection_diagram.md).

## Why

Before this branch, the API had a single native `pg.Pool` built by hand in `PostgisModule`:

- The schema was hard-coded in the pool (`-c search_path=routing,public`). The `DATABASE_SCHEMA` env var was validated but never read.
- The same schema was set in three places that didn't know about each other: the compose `SCHEMA_NAME`, `ALTER DATABASE ... SET search_path` in `init-db`, and the pool options.
- There was no way to register a second database connection, and no way to use TypeORM entities (spatial columns, spatial indexes).
- The pool was never closed on shutdown, because shutdown hooks weren't enabled.

Goals:

1. Keep a concise raw-SQL path for PostGIS operations (`ST_Simplify`, `ST_AsGeoJSON`, ...).
2. Add TypeORM for entities and CRUD.
3. Let features couple to a named database connection.
4. Use **one** pool per database, not one per access style.

## What we built

### 1. Configuration (`AppModule`)
`ConfigModule.forRoot({ isGlobal: true, validationSchema })` loads `.env` and validates it with Joi. The app refuses to start if `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD` or `DATABASE_NAME` is missing. `DATABASE_PORT` defaults to `5432`, and Joi converts it to a number. `isGlobal` makes `ConfigService` injectable everywhere.

`AppModule` only holds the connection *parameters*. The connection itself is created by `PostgisModule`.

### 2. `PostgisModule.forRootAsync({ name, envPrefix? })`
A dynamic, global module. Each call registers one database connection and creates:

- A **named TypeORM DataSource** (`TypeOrmModule.forRootAsync({ name })`), configured through `ConfigService` from the `<envPrefix>HOST/PORT/USER/PASSWORD/NAME` variables. `envPrefix` defaults to `DATABASE_`. The DataSource owns the native `pg` pool (`max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 2000`, passed through `extra`).
- A **`PostgisService`** bound to that DataSource, exported under the token `POSTGIS_SERVICE_<name>`.

`AppModule` registers a single connection:

```ts
PostgisModule.forRootAsync({ name: SPATIALDB_CONNECTION }) // 'spatialdb'
```

### 3. `PostgisService` (raw SQL)
- `query<T>(text, params?: unknown[])` runs parametrized SQL and returns the native `pg` `QueryResult<T>`.
- It runs on **TypeORM's own `pg` pool** (`(dataSource.driver as PostgresDriver).master`), so raw SQL and repositories share the same connections.
- Every query is logged with its duration, row count and pool health (total, idle, waiting) through `PostgisLoggerService`, under the context `PostgisService:<name>`. Failed queries are logged and rethrown.
- It is not `@Injectable`: `PostgisModule` builds one instance per connection with a factory.

### 4. Injecting a connection
| Need | How |
|---|---|
| Raw PostGIS SQL | `@InjectPostgis(SPATIALDB_CONNECTION) private readonly postgis: PostgisService` |
| TypeORM repository | `TypeOrmModule.forFeature([Entity], SPATIALDB_CONNECTION)` in the feature module, plus `@InjectRepository(Entity, SPATIALDB_CONNECTION)` in the service |

`RoutingService` injects both. `SpatialUtilsService` (shared) injects the `PostgisService`.

### 5. Schemas: always explicit
The DataSource has **no default schema** and the pool sets **no `search_path`**, so Postgres uses its default `"$user", public`. PostGIS, postgis_raster and pgRouting are installed in `public`, so `ST_*` functions resolve without a prefix.

- Entities declare their schema: `@Entity({ schema: 'routing', name: 'routes' })`. The `database` option is left out because TypeORM's Postgres driver ignores it.
- Raw SQL names its schema: `SELECT ... FROM routing.routes`.
- Schemas are created **only** in `init-db/spatialdb_setup.sql` (`CREATE SCHEMA IF NOT EXISTS routing;`). TypeORM `synchronize` never creates schemas.

### 6. `synchronize: true` (development only)
On startup TypeORM creates and alters the entity tables. This is how `routing.routes` was created:

| Column | Type |
|---|---|
| `id` | `integer`, PK, serial |
| `name` | `varchar(255)` |
| `description` | `text`, nullable |
| `geom` | `geometry(LineString, 4326)`, GiST index |
| `created_at` | `timestamptz`, default `now()` |
| `updated_at` | `timestamptz`, default `now()` |

This will be replaced by TypeORM migrations, as CLAUDE.md requires.

### 7. Shutdown
`main.ts` calls `app.enableShutdownHooks()`, so TypeORM closes its DataSource and pool on SIGTERM (`docker compose stop`).

## Connection pool rules
- **One `forRootAsync()` call = one pool.** The number of services injecting it doesn't matter: every service using `SPATIALDB_CONNECTION` shares the same 20 connections.
- A new feature in the same database (e.g. `elevation`) **reuses** `SPATIALDB_CONNECTION` and names its own schema (`elevation.dem`, `@Entity({ schema: 'elevation' })`).
- Add a second `forRootAsync({ name, envPrefix })` only for a **different database, host or credentials**, or for deliberate pool isolation. Add its `<prefix>*` keys to the Joi schema too. Every extra pool counts toward Postgres `max_connections` (default 100).
- Data loaded by other tools (Overture, `raster2pgsql`) is reached the same way, by schema-qualified name. TypeORM has no `raster` column type, so raster queries go through `PostgisService`.

## Removed
- The hand-built `PG_POOL` provider and token.
- The `DATABASE_SCHEMA` env var, plus compose `SCHEMA_NAME`.
- `-c search_path` in the pool, plus `ALTER DATABASE spatialdb SET search_path` in `init-db`. On the existing database it was reset with `ALTER DATABASE spatialdb RESET search_path`.

## Dependencies added
- `@nestjs/typeorm@12.0.3`
- `typeorm@1.1.3`

(`pg` was already installed.)

## Files
| File | Role |
|---|---|
| `spatial-operations/src/app.module.ts` | Joi env validation, `PostgisModule.forRootAsync({ name: SPATIALDB_CONNECTION })` |
| `spatial-operations/src/main.ts` | `enableShutdownHooks()` |
| `src/core/infrastructure/postgis/postgis.module.ts` | Dynamic module: named DataSource plus `PostgisService` factory |
| `src/core/infrastructure/postgis/postgis.service.ts` | Raw SQL on the shared pool, with logging |
| `src/core/infrastructure/postgis/postgis.decorator.ts` | `@InjectPostgis(name)` |
| `src/core/infrastructure/postgis/consts/database_constants.ts` | `SPATIALDB_CONNECTION`, `getPostgisServiceToken()` |
| `src/features/routing/entities/routing.entity.ts` | `Route` entity (`routing.routes`) |
| `src/features/routing/routing.module.ts` / `routing.service.ts` | `forFeature([Route])`, injects the repository and `PostgisService` |
| `src/shared/services/spatial-utils/spatial-utils.service.ts` | Injects `PostgisService` by connection name |
| `init-db/spatialdb_setup.sql` | Extensions plus the `routing` schema |
| `docker-compose.yml` | `SCHEMA_NAME` removed |

## Tests and verification
- Unit tests:
  - `PostgisService` against a mocked DataSource pool: query, logging, error rethrow;
  - `PostgisModule` exports one token per connection name;
  - routing and spatial-utils specs use mocked tokens.
- In the container:
  - a query through `PostgisService` returned `current_schema = public` and ran `PostGIS_Version()`;
  - `\d routing.routes` matched the entity.

## Commits
| Commit | Message |
|---|---|
| `86d863d` | feat(postgis): add named TypeORM connections with shared pg pool |
| `f9bedc3` | refactor(postgis): rename ROUTING_CONNECTION to SPATIALDB_CONNECTION |
| `374676f` | refactor(postgis): drop DATABASE_SCHEMA and search_path, enable synchronize |

## Open follow-ups
- Replace `synchronize: true` with TypeORM migrations.
- Two specs were already failing before this branch and are not fixed: `postgis-logger.service.spec.ts` (`get()` on a transient provider) and `app.controller.spec.ts` (imports a missing `app.controller.js`).
- The container runs Node v20, while CLAUDE.md specifies v24.15.0.
- `PostgisLoggerService` still logs with emojis.
