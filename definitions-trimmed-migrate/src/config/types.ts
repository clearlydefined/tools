import { AzureBlobServiceOptions } from '../services/blob-service/types';
import { MigrationServiceOptions } from '../services/migration-service/types';
import { MongoOptions } from '../services/mongo-service/types';
import { RedisOptions } from '../services/redis-service/types';

export type AppConfig = {
    azureBlobServiceOptions: AzureBlobServiceOptions;
    mongoOptions: MongoOptions;
    redisOptions: RedisOptions;
    migrationOptions: MigrationServiceOptions;
    appInsightsOptions: { connectionString: string };
};
