// Name of the TypeORM DataSource (and its PostgisService) for spatialdb, shared by all features.
// Its default schema is DATABASE_SCHEMA; other schemas must be qualified (elevation.table).
export const SPATIALDB_CONNECTION = 'spatialdb';

export const getPostgisServiceToken = (connectionName: string): string =>
  `POSTGIS_SERVICE_${connectionName}`;
