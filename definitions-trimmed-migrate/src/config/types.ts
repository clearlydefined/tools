import { AzureStorageOptions } from '../services/azure-storage-service/types';
import { MigrationServiceOptions } from '../services/migration-service/types';
import { MongoOptions } from '../services/mongo-service/types';
import { RedisOptions } from '../services/redis-service/types';

export type AppConfig = {
    azureStorageOptions: AzureStorageOptions;
    mongoOptions: MongoOptions;
    redisOptions: RedisOptions;
    appInsightsOptions: { connectionString: string };
    expressOptions: { port: number | string };
    migrationOptions: MigrationServiceOptions;
};
