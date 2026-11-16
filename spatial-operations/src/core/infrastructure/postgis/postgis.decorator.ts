import { Inject } from '@nestjs/common';
import { getPostgisServiceToken } from './consts/database_constants.js';

export const InjectPostgis = (connectionName: string): ReturnType<typeof Inject> =>
  Inject(getPostgisServiceToken(connectionName));
