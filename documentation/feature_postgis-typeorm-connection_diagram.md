# feature/postgis-typeorm-connections: diagrams

Explained in words in [feature_postgis-typeorm-connection.md](./feature_postgis-typeorm-connection.md).

## 1. Module wiring and the shared pool (flowchart)
How one `PostgisModule.forRootAsync()` call becomes one pool, and how features reach it through TypeORM or raw SQL.

```mermaid
flowchart LR
    env[".env<br/>DATABASE_HOST / PORT / USER<br/>PASSWORD / NAME"]

    subgraph App["AppModule"]
        config["ConfigModule.forRoot<br/>isGlobal + Joi validation"]
        reg["PostgisModule.forRootAsync<br/>name: SPATIALDB_CONNECTION"]
    end

    subgraph Postgis["PostgisModule (global, one per connection name)"]
        ds["TypeORM DataSource 'spatialdb'<br/>synchronize: true<br/>autoLoadEntities: true"]
        pool[("pg Pool<br/>max 20")]
        svc["PostgisService<br/>token POSTGIS_SERVICE_spatialdb"]
        logger["PostgisLoggerService"]
    end

    subgraph Features["Feature / shared modules"]
        routing["RoutingService"]
        repo["Repository&lt;Route&gt;<br/>forFeature([Route], 'spatialdb')"]
        utils["SpatialUtilsService"]
    end

    subgraph DB["PostGIS: spatialdb"]
        pub["public<br/>postgis, postgis_raster, pgrouting"]
        rschema["routing.routes<br/>geom LineString 4326 + GiST"]
    end

    env --> config
    config -- "ConfigService" --> ds
    reg --> ds
    ds -- "owns (driver.master)" --> pool
    svc -- "raw SQL on" --> pool
    logger -.-> svc
    repo -- "ORM queries on" --> pool
    routing -- "@InjectRepository(Route, 'spatialdb')" --> repo
    routing -- "@InjectPostgis('spatialdb')" --> svc
    utils -- "@InjectPostgis('spatialdb')" --> svc
    pool --> pub
    pool --> rschema
```

## 2. Startup, query and shutdown lifecycle (sequence diagram)
What happens in order when the `euclid-api` container starts, serves a raw PostGIS query, and stops.

```mermaid
sequenceDiagram
    autonumber
    participant Docker as docker compose
    participant Init as init-db (spatialdb_setup.sql)
    participant Nest as NestFactory / AppModule
    participant Cfg as ConfigService
    participant TO as TypeORM DataSource 'spatialdb'
    participant Svc as PostgisService
    participant Feat as RoutingService
    participant PG as PostGIS spatialdb

    Docker->>Init: start euclid-pg
    Init->>PG: CREATE EXTENSION postgis ... / CREATE SCHEMA IF NOT EXISTS routing
    Docker->>Nest: start euclid-api (after postgis is healthy)
    Nest->>Cfg: load .env and validate with Joi
    alt missing required DATABASE_* variable
        Cfg-->>Nest: validation error, app does not start
    end
    Nest->>TO: forRootAsync useFactory(ConfigService)
    TO->>PG: open pg Pool (max 20)
    TO->>PG: synchronize: create/alter routing.routes (schema must already exist)
    Nest->>Svc: factory new PostgisService(dataSource, logger, 'spatialdb')
    Svc-->>Nest: onModuleInit: "PostgreSQL Connection Pool initialized."
    Nest->>Feat: inject Repository<Route> and PostgisService

    Feat->>Svc: query("SELECT ST_AsGeoJSON(geom) FROM routing.routes WHERE id = $1", [id])
    Svc->>PG: pool.query (same pool as the repository)
    PG-->>Svc: QueryResult
    Svc-->>Feat: rows (duration, row count and pool stats logged)

    Docker->>Nest: SIGTERM (docker compose stop)
    Nest->>TO: enableShutdownHooks: destroy DataSource
    TO->>PG: close pool connections
```

## 3. Schema convention (ER view)
TypeORM's view of `spatialdb` after this branch. Every table belongs to an explicitly named schema, and `public` only hosts the extensions.

```mermaid
erDiagram
    ROUTING_ROUTES {
        integer id PK "serial"
        varchar name "255, not null"
        text description "nullable"
        geometry geom "LineString, SRID 4326, GiST index"
        timestamptz created_at "default now()"
        timestamptz updated_at "default now()"
    }
```
