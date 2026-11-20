# feature/routes-crud

The routes CRUD of the NestJS API (`spatial-operations`). It stores driving or hand-drawn routes in PostGIS, builds road routes through OpenRouteService (ORS), and serves them back as GeoJSON for a Leaflet client.

Built on the integration branch `feature/routes-crud`, one sub-branch per operation; it is not merged into `master` yet. Diagrams: [feature_routes-crud_diagram.md](./feature_routes-crud_diagram.md).

## Why

Before this branch, `routing` was the Nest scaffold:
- `@Controller('routing')` had no real logic.
- `CreateRoutingDto` was empty.
- `shared/dto/geojson.dto.ts` used `any[]`.
- A stale `ORS` constant pointed at the wrong port.

The goal was the sequence in CLAUDE.md:
- create a route (random, ORS or hybrid) and store it simplified;
- list the routes (metadata only) for the client's sidebar;
- load one route's geometry when a row is clicked;
- update and delete routes.

## Endpoints

Global prefix `api`, no versioning. Swagger is at `/api/docs`.

| Method and path | What it does | Database access | Success | Errors |
|---|---|---|---|---|
| `POST /api/routes` | Create a route from ordered segments | **Raw SQL** (`PostgisService`) | 201 `RouteSummaryDto` | 400, 422, 502, 503, 504 |
| `GET /api/routes` | List all routes, metadata only, newest first | **TypeORM repository** | 200 `RouteSummaryDto[]` | |
| `GET /api/routes/:id` | One route as a GeoJSON `Feature` | **Raw SQL** (`PostgisService`) | 200 `RouteFeatureDto` | 400, 404 |
| `PATCH /api/routes/:id` | Update metadata and/or replace the segments | **Raw SQL** (`PostgisService`) | 200 `RouteSummaryDto` | 400, 404, 422, 502, 503, 504 |
| `DELETE /api/routes/:id` | Delete one route | **TypeORM repository** | 204 | 400, 404 |
| `DELETE /api/routes?confirm=true` | Delete all routes and restart the ids | **Raw SQL** (`PostgisService`) | 204 | 400 |

`RouteSummaryDto` is `{ id, name, description, type, createdAt }`.

## Database access: TypeORM repository or raw SQL

`RoutingService` has two ways into the database. Both run on the **same** `spatialdb` connection pool (see [feature_postgis-typeorm-connection.md](./feature_postgis-typeorm-connection.md)):

- **TypeORM repository**: `@InjectRepository(Route, SPATIALDB_CONNECTION) routeRepository: Repository<Route>`. TypeORM writes the SQL from the `Route` entity.
- **Raw SQL**: `@InjectPostgis(SPATIALDB_CONNECTION) postgis: PostgisService`, calling `postgis.query(sql, params)` with SQL written in `routing.service.ts`. Parameters are always passed as `$1, $2, ...`, never concatenated into the text.

The rule: **raw SQL whenever PostGIS functions are needed in the statement, or when the statement is something TypeORM can't express cleanly; the repository for plain CRUD with no spatial work.**

| Service method | Endpoint | Access | Exact call | Why this path |
|---|---|---|---|---|
| `create` | `POST /api/routes` | **Raw SQL** | `postgis.query(INSERT_ROUTE_SQL, ...)` | The geometry is built inside the statement: `ST_GeomFromGeoJSON`, `ST_SetSRID`, `ST_Transform`, `ST_Simplify` |
| `findAll` | `GET /api/routes` | **TypeORM repository** | `routeRepository.find({ select, order })` | Plain columns, no geometry, no PostGIS function |
| `findOne` | `GET /api/routes/:id` | **Raw SQL** | `postgis.query(SELECT_ROUTE_FEATURE_SQL, [id])` | Needs `ST_AsGeoJSON(geom, 6)` to return GeoJSON with 6 decimals |
| `update` | `PATCH /api/routes/:id` | **Raw SQL** | `postgis.query(UPDATE_ROUTE_SQL, ...)` | Same simplify functions as create; `COALESCE` keeps the fields that weren't sent |
| `remove` | `DELETE /api/routes/:id` | **TypeORM repository** | `routeRepository.delete(id)` | Plain delete by primary key; `affected` gives the 404 |
| `removeAll` | `DELETE /api/routes?confirm=true` | **Raw SQL** | `postgis.query('TRUNCATE TABLE routing.routes RESTART IDENTITY')` | The repository has no `TRUNCATE ... RESTART IDENTITY` |

Two consequences of using raw SQL:
- Raw SQL names the schema itself (`routing.routes`). The repository takes it from `@Entity({ schema: 'routing', name: 'routes' })`.
- TypeORM's automatic columns (`@CreateDateColumn`, `@UpdateDateColumn`) are filled by TypeORM only. In raw SQL, `created_at` comes from the column default `now()`, and the `UPDATE` sets `updated_at = now()` itself.

**ORS is not a database access.** `buildRoute` calls OpenRouteService over HTTP *before* any SQL runs. It never touches the database.

## The request: ordered segments

A route is sent as a list of **segments**. Each one has a `mode` and a GeoJSON `LineString` (`[lon, lat]`, EPSG:4326):

```json
{
  "name": "Aviles to Gijon",
  "description": "Walk to the car, drive, walk to the destination",
  "segments": [
    { "mode": "manual", "geometry": { "type": "LineString", "coordinates": [[-5.9275, 43.5578], [-5.9248, 43.556]] } },
    { "mode": "ors",    "geometry": { "type": "LineString", "coordinates": [[-5.9248, 43.556], [-5.6615, 43.5357]] } },
    { "mode": "manual", "geometry": { "type": "LineString", "coordinates": [[-5.6615, 43.5357], [-5.6589, 43.5385]] } }
  ]
}
```

- **`manual`**: the line the user drew. It is stored as given.
- **`ors`**: the vertices are **waypoints**. ORS (`driving-car`) returns the road path through them.

The client never sends the route `type`. The server derives it from the modes:

| Segment modes | `type` |
|---|---|
| all `manual` | `random` |
| all `ors` | `ors` |
| mixed | `hybrid` |

### Validation (pipes and class-validator)
The global `ValidationPipe` runs with `whitelist`, `forbidNonWhitelisted` and `transform`, so unknown properties are rejected with a 400. This includes `type` and `orsProperties` sent by a client.

- `name`: required, non-empty string, 255 characters at most. `description` is optional.
- `segments`: at least 1.
  - **`@SegmentsAreContinuous()`**: each segment must start at the last position of the previous one. Otherwise: `segments[1] must start at the last position of segments[0]`.
- `geometry`: `type` must be `LineString`.
  - **`@IsLonLatArray()`**: at least 2 positions, each exactly `[lon, lat]` with lon in -180..180 and lat in -90..90.
- **`@OrsWaypointsWithinLimit()`**: an `ors` segment has 50 waypoints at most (`maximum_waypoints` in `ors-config.yml`). Manual segments have no limit.

The example bodies for random, ors and hybrid are in Swagger, under the request body of `POST /api/routes` (`dto/create-route.examples.ts`).

## Building a route (create and update)

`RoutingService.buildRoute(segments)` is shared by create and update. It runs **in TypeScript and over HTTP to ORS, with no database access**. Only afterwards is the result written, with **raw SQL** (`INSERT` for create, `UPDATE` for update):

1. **Resolve each segment into a leg.**
   - A manual segment's leg is its own coordinates.
   - An ors segment calls `OrsService.getDrivingRoute(waypoints)`, and its leg is the road geometry ORS returns.
   - ORS calls run **in parallel** (`Promise.all`), and the result keeps the segment order.
2. **Stitch** (`stitchLegs`, pure TypeScript): the legs are concatenated **in segment order**.
   - When a leg starts exactly where the previous one ended, that shared vertex is kept once.
   - Otherwise the gap becomes a straight connector. ORS snaps waypoints to the nearest road, so its start can sit a few metres from where the user's previous segment ended.
   - `ST_LineMerge` is not used: it can reorder or split lines, and it doesn't close gaps.
3. **Derive the type** (`deriveRouteType`).
4. **Keep the input.** Each stored segment is the original `{ mode, geometry }`. An ors segment also gets **`orsProperties`**, the `features[0].properties` of the ORS response (summary, segments/steps, way_points).

The result is always a **single LineString**.

### Simplify on write
**Raw SQL** (`PostgisService`): the stitched line is simplified inside the raw `INSERT`/`UPDATE` statement, **in metres**:

```sql
ST_Transform(ST_Simplify(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($n::text), 4326), 25830), 1, true), 4326)
```

- `METRIC_SRID = 25830` is ETRS89 / UTM 30N, which covers Asturias.
- `SIMPLIFY_TOLERANCE_M = 1`.
- `preserveCollapsed = true` keeps very short routes from disappearing.

Simplifying in EPSG:4326 would give a tolerance in degrees, which isn't the same distance everywhere.

## OpenRouteService client (`src/core/infrastructure/ors/`)

- `OrsModule` registers `HttpModule` with `baseURL = ORS_BASE_URL` and `timeout = ORS_REQUEST_TIMEOUT_MS`. Both are validated by Joi at startup.
- `OrsService.getDrivingRoute()` sends `POST /v2/directions/driving-car/geojson` with `{ coordinates }`, and checks that `features[0].geometry` is a LineString.
- The ORS response types are strict interfaces (`ors.types.ts`), with no `any`.
- **Error mapping:**

| ORS outcome | API answer |
|---|---|
| ORS 4xx (e.g. no road within 350 m, code 2010) | 422 with the ORS message |
| ORS 503 (graphs still loading) | 503 |
| Timeout (`ECONNABORTED` / `ETIMEDOUT`) | 504 |
| Connection refused, other network error, ORS 5xx, unexpected body | 502 |

`RoutingService` adds the failing segment to the message and keeps the status code, e.g. `segments[1] (ors): Could not find routable point within a radius of 350.0 meters ...`. The index starts at 0, as in the validation messages. When any segment fails, nothing is stored.

**Environment note:** inside the Docker network ORS listens on port **8082**, so `.env` has `ORS_BASE_URL=http://ors:8082/ors`. The 8080 port only exists on the host.

## Storage: `routing.routes`

Created by TypeORM `synchronize` from the `Route` entity (`@Entity({ schema: 'routing', name: 'routes' })`):

| Column | Type | Notes |
|---|---|---|
| `id` | `integer`, PK, serial | |
| `name` | `varchar(255)` | |
| `description` | `text`, nullable | |
| `type` | `varchar(16)` | `random` / `ors` / `hybrid`, derived |
| `segments` | `jsonb` | Original input, plus `orsProperties` on ors segments |
| `geom` | `geometry(LineString, 4326)`, GiST index | Stitched and simplified |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Set by TypeORM, or by `now()` in the raw `UPDATE` |

Why keep both `segments` and `geom`?
- `geom` is what the map shows.
- `segments` is what the user asked for: their waypoints and drawn lines, which can't be recovered from the simplified road geometry. It also keeps the ORS distance and duration, and is what a client needs to edit a route.

## Reading routes

- **List** (`GET /api/routes`), **TypeORM repository**: `routeRepository.find(...)` selects only `id, name, description, type, createdAt`, ordered by `createdAt DESC, id DESC`. It reads no geometry, so the sidebar list stays light.
- **One** (`GET /api/routes/:id`), **raw SQL** (`PostgisService`): `SELECT ... ST_AsGeoJSON(geom, 6)::json AS geometry FROM routing.routes WHERE id = $1`. It returns a GeoJSON `Feature`:
  - `id`;
  - `geometry`, the stored LineString with 6 decimals (about 0.1 m);
  - `properties`: `name`, `description`, `type`, `segments` and `createdAt`.

  The response can go straight into `L.geoJSON(feature)`.

## Updating routes (`PATCH /api/routes/:id`)

`UpdateRouteDto` has three optional fields. Anything left out keeps its value:

- `name`: may not be `null`.
- `description`: `null` clears it.
- `segments`: replaces all segments. The route is rebuilt with `buildRoute`, so `geom`, `type` and `segments` all change.

The DTO declares its fields itself instead of using `PartialType(CreateRouteDto)`. `PartialType` adds `@IsOptional`, which also accepts `null`, so `name: null` would reach the `NOT NULL` column and fail with a 500. `name` and `segments` use `@ValidateIf(value !== undefined)` instead.

**Raw SQL** (`PostgisService`), never the repository: a single `UPDATE routing.routes ...` statement covers every case, metadata-only or with new segments:
- `COALESCE($n, column)` keeps fields that weren't sent;
- a boolean flag tells "description not sent" apart from "description: null";
- `updated_at = now()` is set explicitly, because TypeORM's `@UpdateDateColumn` doesn't run for raw SQL.

An empty body returns 400 (`Nothing to update: ...`).

## Deleting routes

- `DELETE /api/routes/:id`, **TypeORM repository**: `routeRepository.delete(id)`. It returns 404 when no row was affected. There's no confirmation flag.
- `DELETE /api/routes?confirm=true`, **raw SQL** (`PostgisService`): `TRUNCATE TABLE routing.routes RESTART IDENTITY`, so the next route gets id 1.
  - `confirm` goes through `ParseBoolPipe` with a custom exception.
  - A missing `confirm`, `confirm=false` or a non-boolean value all return 400 `confirm=true is required to delete all routes`.
  - This handler has no `:id`, so it doesn't clash with the single delete.

## Ids
`:id` goes through `ParseIntPipe`, so `abc` returns 400. Ids that can't exist (0 or below, or above 2,147,483,647, the `integer` maximum) return 404 without querying the database. Otherwise Postgres would fail with "out of range" and the API would answer 500.

## Files
| File | Role |
|---|---|
| `src/main.ts` | `setGlobalPrefix('api')`, Swagger at `api/docs`, global `ValidationPipe` |
| `src/app.module.ts` | Joi: `ORS_BASE_URL`, `ORS_REQUEST_TIMEOUT_MS` |
| `src/core/infrastructure/ors/ors.module.ts` | `HttpModule` configured from `.env` |
| `src/core/infrastructure/ors/ors.service.ts` | `getDrivingRoute()` and the error mapping |
| `src/core/infrastructure/ors/ors.types.ts` / `ors.consts.ts` | ORS response types, path, 50-waypoint limit |
| `src/shared/dto/line-string.dto.ts` | GeoJSON LineString DTO |
| `src/shared/validators/is-lon-lat-array.validator.ts` | `@IsLonLatArray()` |
| `src/features/routing/routing.controller.ts` | The six endpoints and their Swagger docs |
| `src/features/routing/routing.service.ts` | `create`, `findAll`, `findOne`, `update`, `remove`, `removeAll`, `buildRoute`; the raw SQL statements (`INSERT_ROUTE_SQL`, `SELECT_ROUTE_FEATURE_SQL`, `UPDATE_ROUTE_SQL`, `TRUNCATE_ROUTES_SQL`) |
| `src/features/routing/route-geometry.builder.ts` | `stitchLegs`, `deriveRouteType` |
| `src/features/routing/dto/*.ts` | `CreateRouteDto`, `UpdateRouteDto`, `RouteSegmentDto`, `RouteSummaryDto`, `RouteFeatureDto`, Swagger examples |
| `src/features/routing/validators/*.ts` | `@SegmentsAreContinuous()`, `@OrsWaypointsWithinLimit()` |
| `src/features/routing/entities/routing.entity.ts` | `Route` entity, with the new `type` and `segments` columns |
| `src/features/routing/enums/*.ts`, `interfaces/*.ts`, `consts/*.ts` | `SegmentMode`, `RouteType`, `StoredSegment`, simplify constants |

Removed: `shared/consts/endpoints.ts` (the stale `ORS` constant), and the scaffold `CreateRoutingDto`/`UpdateRoutingDto`.

## Tests and verification
71 unit tests (Vitest) across the routing and ORS specs:
- **Request validation:** continuity, coordinates, the waypoint limit, unknown or client-sent properties, and the update `null` rules.
- **`stitchLegs` and `deriveRouteType`:** shared vertices, connectors and the three types.
- **`OrsService`** with a mocked `HttpService`: success, 4xx, 503, 5xx, timeout, connection refused.
- **`RoutingService`:**
  - the SQL parameters for each operation, hybrid stitching and segment order with parallel ORS calls;
  - the segment-named errors, nothing stored when ORS fails, 404 and 400 paths.
- **Controller:** each endpoint calls the service.

The two specs that were already failing (`postgis-logger`, `app.controller`) are unchanged.

Checked against the containers (`docker compose up --build`), with ORS running:

| Check | Result |
|---|---|
| ors route Avilés to Oviedo | 201. In psql: a single LineString, `ST_IsSimple`, `orsProperties` present |
| hybrid manual, ors, manual | 201 `hybrid`, `orsProperties` on the ors segment only |
| ors waypoint at sea | 422 `segments[n] (ors): Could not find routable point ...` |
| 51 ors waypoints / client `orsProperties` | 400 |
| ORS container stopped | 502 `OpenRouteService is unreachable` |
| list / one / missing id / `abc` | 200 / 200 Feature / 404 / 400 |
| PATCH rename, `description: null`, segments to hybrid | 200, `updated_at` moves, geometry rebuilt (2 to 418 points) |
| PATCH with an ORS failure | 422, the row is unchanged |
| DELETE one, then again | 204, then 404 |
| DELETE all: no flag / `false` / `yes` / `true` | 400 / 400 / 400 / 204; the next id is 1 |

## Commits
Each sub-branch was cut from the current `feature/routes-crud` and merged back with `--no-ff`.

| Sub-branch | Commit | Message |
|---|---|---|
| `feature/routes-crud-create-random` | `a5868e3` | feat(routing): create random routes via POST /api/routes |
| `feature/routes-crud-create-ors` | `47dee6f` | feat(routing): create ors and hybrid routes through OpenRouteService |
| `feature/routes-crud-create-hybrid` | `159579c` | test(routing): harden hybrid route creation |
| `feature/routes-crud-find-all` | `bce95c7` | feat(routing): list route summaries via GET /api/routes |
| `feature/routes-crud-find-one` | `17ffdd2` | feat(routing): get one route as a GeoJSON Feature via GET /api/routes/:id |
| `feature/routes-crud-update` | `b9d435e` | feat(routing): update routes via PATCH /api/routes/:id |
| `feature/routes-crud-remove` | `e3918fd` | feat(routing): delete a route via DELETE /api/routes/:id |
| `feature/routes-crud-remove-all` | `233aaa1` | feat(routing): delete all routes via DELETE /api/routes?confirm=true |

## Open follow-ups
- Replace `synchronize: true` with TypeORM migrations before `feature/routes-crud` goes to `master`.
- Phase 2: FlatGeobuf export (`feature/routes-fgb-export`). Phase 3 (optional): vector tiles with `ST_AsMVT` (`feature/routes-mvt`).
- A `PATCH` with `segments` for an id that doesn't exist calls ORS before returning 404. Nothing is stored, but those ORS calls are wasted.
- Road routes can cross themselves (roundabouts, loops), so `ST_IsSimple` can be false. This is reported but not rejected.
- There's no ESLint config (`eslint.config.*`), so lint doesn't run.
- The two specs that were already failing, the container running Node v20 (CLAUDE.md says v24.15.0), and the emojis in `PostgisLoggerService` are still open from the previous feature.
