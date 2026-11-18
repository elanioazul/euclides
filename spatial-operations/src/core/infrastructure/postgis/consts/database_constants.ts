// Name of the TypeORM DataSource (and its PostgisService) for spatialdb, shared by all features.
// It has no default schema: name it explicitly in raw SQL (routing.routes) and in @Entity({ schema }).
export const SPATIALDB_CONNECTION = 'spatialdb';

export const getPostgisServiceToken = (connectionName: string): string =>
  `POSTGIS_SERVICE_${connectionName}`;
