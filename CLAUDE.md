# CLAUDE.md

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---


## Project
A dockerized restAPI based in nest that act as a middleware between openrouteservice and postgis (the first for driving-car profile logic and the second for storing data routes).

## Stack
- docker 
- node v24.15.0
- nest.js (v12.0.1)
- postgis (v17-3.5)
- openrouteservice (v10.1.0)

## Aim
Achiving the following restAPI sequence (Mermaid/Excalidraw notation):
sequenceDiagram
    autonumber
    actor User as User / Leaflet Client
    participant Nest as Swagger API
    participant ORS as OpenRouteService
    participant DB as PostGIS-geodataDB

    rect rgb(240, 248, 255)
        note over User, DB: 1. CREATE & SAVE ROUTE (Random, ORS, or Hybrid)
        User->>Nest: POST /api/v1/routes (Payload with type & segments/points)
        alt type == ors or hybrid (has ORS legs)
            Nest->>ORS: POST /ors/v2/directions/driving-car
            ORS-->>Nest: Return Road-Snapping GeoJSON LineString
        end
        note over Nest: NestJS processes/stitches geometries & applies ST_Simplify()
        Nest->>DB: INSERT INTO routes (name, description, geom) VALUES (...)
        DB-->>Nest: Success Confirmation
        Nest-->>User: 201 Created (Route Metadata & ID)
    end

    rect rgb(240, 248, 255)
        note over User, DB: 2. READ & LAZY-LOAD (Accordion & Map Rendering)
        User->>Nest: GET /api/v1/routes (Fetch Metadata List)
        Nest->>DB: SELECT id, name, description, created_at FROM routes
        DB-->>Nest: Return Route Summaries
        Nest-->>User: 200 OK (JSON Array of Metadata)
        note over User: Sidebar Accordion renders route names & descriptions
        
        User->>Nest: GET /api/v1/routes/{id} (Click specific accordion row)
        Nest->>DB: SELECT ST_AsGeoJSON(geom) FROM routes WHERE id = {id}
        DB-->>Nest: Return Geometry Feature
        Nest-->>User: 200 OK (GeoJSON Feature)
        note over User: Leaflet renders the selected route geometry on map
    end

    rect rgb(240, 248, 255)
        note over User, DB: 3. UPDATE & DELETE OPERATIONS
        User->>Nest: PATCH /api/v1/routes/{id} (Update Name/Description/Geometry)
        Nest->>DB: UPDATE routes SET ... WHERE id = {id}
        DB-->>Nest: Success Confirmation
        Nest-->>User: 200 OK (Updated Route)

        User->>Nest: DELETE /api/v1/routes/{id} (Delete Single Route)
        Nest->>DB: DELETE FROM routes WHERE id = {id}
        DB-->>Nest: Success Confirmation
        Nest-->>User: 204 No Content

        User->>Nest: DELETE /api/v1/routes (Delete All Routes)
        Nest->>DB: TRUNCATE TABLE routes
        DB-->>Nest: Success Confirmation
        Nest-->>User: 204 No Content
    end

## Commands

## Architecture
init-db (kartoza/postgis .sql scripts database initizalization)
ors (written by ors volume´s service)
├──logs
spatial-operations (nest.js rest api)
├──dist
├──node_modules
├──src
    ├──core
        ├──infraestructure (a postgis (node-postgres) querier with custom logger)
    ├──features
        ├──routing (logic related to routing endpoints)
    ├──shared (shared files for all geospatial features we might develop besides of routing)
    main.js (where DocumentBuilder and GlobalPipes are set)
├──test
├──Dockerfile
├──package.json
├──...other nest.js files
.env
.gitignore
docker-compose.yml
ors-config.yml
README.md

## Rules
- Use strict typing (No `any` in TypeScript). Use TypeScript strict for all new files
- Defensive code required
- Component names in PascalCase and method names in camelCase
- Use exensibly Swagger package to openapi the restAPI we are building
- In nest.js, use pipes for transformation and validation
- In early stages of the apiREST development, lets set synchronize: true in the TYPEORM connexion, but take into account that you have to show me at some point how to operate with migrations.

## Prohibitions

## Workflow
For each feature:
- Present a plan
- Wait for my approval
- Branches: feature/<ticket>, fix/<ticket>
- Test it building running the images (docker compose up)
- Make neccesary unit testing
- Conventional commits mandatory
- PR review required before merge

## Geospatial Stack Preferences
- Prefer Typescript-based approaches
- Use existing npm packages instead of building solutions from scratch
- My preference for geospatial packages are below
  - turf.js for managing vector geospatial data if needed
  - flatgeobuf for data encoding (Deserialize FlatGeobuf into GeoJSON features & Serialize GeoJSON to FlatGeobuf)
  - typeorm (spatial index & spatial columns)
  - raw postgisSQL queries

## Other Preferences
- Write code that is simple to understand
- Explain the code with comments only when its a difficult part
- Do not use emojis
- Always install npm packages and make the container shipped read them sucessfully. Ask the user for confirmation before installing any dependency needed.