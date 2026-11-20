# feature/routes-crud: diagrams

Explained in words in [feature_routes-crud.md](./feature_routes-crud.md).

Database access in every diagram:
- **Raw SQL** (`PostgisService.query`): `create` (INSERT), `findOne` (SELECT `ST_AsGeoJSON`), `update` (UPDATE), `removeAll` (TRUNCATE).
- **TypeORM repository** (`Repository<Route>`): `findAll` (`find`), `remove` (`delete`).

Both use the same `spatialdb` pool. OpenRouteService is HTTP only and never touches the database.

## 1. Create a route: random, ors or hybrid (sequence diagram)
`POST /api/routes`, from validation to the stored row. The only database access is the final **raw SQL** `INSERT` through `PostgisService`; the TypeORM repository is not used. `PATCH /api/routes/:id` with `segments` follows the same path, but runs a raw SQL `UPDATE` at the end.

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Leaflet client
    participant Pipe as ValidationPipe
    participant Ctrl as RoutingController
    participant Svc as RoutingService
    participant ORS as OrsService / OpenRouteService (HTTP)
    participant Raw as PostgisService (raw SQL)
    participant DB as PostGIS (routing.routes)

    User->>Pipe: POST /api/routes { name, description?, segments[] }
    alt invalid payload (coordinates, continuity, >50 ors waypoints, unknown property)
        Pipe-->>User: 400 Bad Request
    end
    Pipe->>Ctrl: CreateRouteDto
    Ctrl->>Svc: create(dto)
    Note over Svc: buildRoute(segments)
    par one call per ors segment (Promise.all keeps the order)
        Svc->>ORS: POST /v2/directions/driving-car/geojson { coordinates: waypoints }
        alt ORS 4xx (no road nearby)
            ORS-->>Svc: 422
            Svc-->>User: 422 "segments[i] (ors): <ORS message>", nothing stored
        else ORS 503 / timeout / unreachable
            ORS-->>Svc: 503 / 504 / 502
            Svc-->>User: same status, segment named, nothing stored
        end
        ORS-->>Svc: features[0]: LineString + properties
    end
    Note over Svc: manual leg = drawn line<br/>ors leg = road geometry + orsProperties
    Note over Svc: stitchLegs: concat in order,<br/>shared vertex kept once, gap = connector
    Note over Svc: deriveRouteType: random / ors / hybrid<br/>(no database access until here)
    Svc->>Raw: postgis.query(INSERT_ROUTE_SQL, params)
    Raw->>DB: INSERT INTO routing.routes (name, description, type, segments::jsonb,<br/>ST_Simplify in EPSG:25830 (1 m) back to 4326) RETURNING ...
    DB-->>Raw: id, name, description, type, created_at
    Raw-->>Svc: QueryResult rows[0]
    Svc-->>Ctrl: RouteSummaryDto
    Ctrl-->>User: 201 Created
```

## 2. Stitching legs into one LineString (flowchart)
How `stitchLegs` joins the legs of a hybrid route, and why the result is always one line. Everything before the last step runs in TypeScript; only the simplify step is SQL (raw, through `PostgisService`).

```mermaid
flowchart LR
    subgraph Input["Request segments (continuous)"]
        s0["segments[0] manual<br/>A to B (drawn)"]
        s1["segments[1] ors<br/>waypoints B to C"]
        s2["segments[2] manual<br/>C to D (drawn)"]
    end

    subgraph Legs["Resolved legs"]
        l0["leg 0: A ... B"]
        l1["leg 1: B' ... C'<br/>(road, snapped near B and C)"]
        l2["leg 2: C ... D"]
    end

    s0 --> l0
    s1 -- "ORS driving-car" --> l1
    s2 --> l2

    l0 --> j1{"leg 1 starts<br/>at B?"}
    l1 --> j1
    j1 -- "yes: keep B once" --> line
    j1 -- "no: straight connector B to B'" --> line
    l2 --> j2{"leg 2 starts<br/>at C'?"}
    j2 -- "yes: keep once" --> line
    j2 -- "no: connector C' to C" --> line

    line["One LineString (TypeScript)<br/>A ... B, B' ... C', C ... D"] --> simp["Raw SQL INSERT / UPDATE<br/>via PostgisService:<br/>ST_Simplify 1 m in EPSG:25830"] --> geom[("routing.routes.geom")]
```

## 3. Request and response flow for every endpoint (flowchart)
What each endpoint reads or writes, and through which access path. Orange arrows are **raw SQL** through `PostgisService`; blue arrows are the **TypeORM repository**. Both run on the same `spatialdb` pool.

```mermaid
flowchart TB
    client["Leaflet client / Swagger (/api/docs)"]

    subgraph API["RoutingController (/api/routes)"]
        post["POST /"]
        list["GET /"]
        one["GET /:id"]
        patch["PATCH /:id"]
        del["DELETE /:id"]
        delall["DELETE /?confirm=true"]
    end

    subgraph Service["RoutingService"]
        build["buildRoute()<br/>ORS + stitch + type"]
        raw["RAW SQL<br/>PostgisService.query()"]
        repo["TYPEORM REPOSITORY<br/>Repository&lt;Route&gt;"]
    end

    ors["OpenRouteService<br/>ors:8082/ors"]
    db[("PostGIS spatialdb<br/>routing.routes")]

    client --> API
    post --> build
    patch -- "segments sent" --> build
    build -- "HTTP: ors segments only" --> ors
    post -- "raw SQL: INSERT + ST_Simplify" --> raw
    patch -- "raw SQL: UPDATE COALESCE + updated_at = now()" --> raw
    one -- "raw SQL: SELECT ST_AsGeoJSON(geom, 6)" --> raw
    delall -- "raw SQL: TRUNCATE RESTART IDENTITY" --> raw
    list -- "repository: find(select metadata, order createdAt DESC)" --> repo
    del -- "repository: delete(id), affected = 0 gives 404" --> repo
    raw --> db
    repo --> db

    classDef rawSql fill:#fde7d3,stroke:#d9822b,color:#000
    classDef typeorm fill:#dbe9fb,stroke:#2b6cd9,color:#000
    class raw,post,one,patch,delall rawSql
    class repo,list,del typeorm
    linkStyle 4,5,6,7,10 stroke:#d9822b,stroke-width:2px
    linkStyle 8,9,11 stroke:#2b6cd9,stroke-width:2px
```

## 4. Lifecycle of a stored route (state diagram)
What each operation does to one row, and to its `type`. Each transition names its access path: **raw SQL** (`PostgisService`) or **repository** (TypeORM).

```mermaid
stateDiagram-v2
    [*] --> Stored: POST 201 [raw SQL INSERT]<br/>type derived from segment modes
    Stored --> Stored: PATCH name / description [raw SQL UPDATE]<br/>metadata only, updated_at = now()
    Stored --> Stored: PATCH segments [raw SQL UPDATE]<br/>rebuilt: geom, type, segments, updated_at
    Stored --> Stored: PATCH that fails (400 / 422 / 5xx)<br/>no SQL runs, row unchanged
    Stored --> Stored: GET / [repository find]<br/>GET /:id [raw SQL SELECT ST_AsGeoJSON]
    Stored --> [*]: DELETE /:id (204) [repository delete]
    Stored --> [*]: DELETE ?confirm=true (204) [raw SQL TRUNCATE]<br/>all rows, ids restart at 1

    state Stored {
        random: random<br/>all manual
        ors: ors<br/>all ors
        hybrid: hybrid<br/>mixed
        random --> hybrid: PATCH segments
        hybrid --> ors: PATCH segments
        ors --> random: PATCH segments
    }
```

## 5. Table after this branch (ER view)
`routing.routes` as created by TypeORM `synchronize` from the `Route` entity. `segments` holds the original input. Each stored segment has the following shape (it lives inside the jsonb column; it isn't a table):

```mermaid
erDiagram
    ROUTING_ROUTES {
        integer id PK "serial"
        varchar name "255, not null"
        text description "nullable"
        varchar type "16: random | ors | hybrid, derived"
        jsonb segments "StoredSegment[] (original input)"
        geometry geom "LineString, SRID 4326, GiST index, simplified 1 m"
        timestamptz created_at "default now()"
        timestamptz updated_at "default now(), set on PATCH"
    }
    STORED_SEGMENT {
        varchar mode "manual | ors"
        jsonb geometry "LineString: drawn line or ORS waypoints"
        jsonb orsProperties "ors only: summary, segments, way_points"
    }
    ROUTING_ROUTES ||--|{ STORED_SEGMENT : "segments (jsonb array)"
```
