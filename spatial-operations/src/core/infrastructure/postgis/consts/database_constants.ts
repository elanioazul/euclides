// Name of the TypeORM DataSource (and its PostgisService) bound to the routing schema
export const ROUTING_CONNECTION = 'routing';

export const getPostgisServiceToken = (connectionName: string): string =>
  `POSTGIS_SERVICE_${connectionName}`;
