import { AzureBlobServiceOptions } from '../services/blob-service/types';
import { LogService } from '../services/log-service/LogService';
import { MigrationServiceOptions } from '../services/migration-service/types';
import { MongoOptions } from '../services/mongo-service/types';
import { RedisOptions } from '../services/redis-service/types';
import { AppConfig } from './types';

export const config: AppConfig = {
    azureBlobServiceOptions: {
        connectionString: process.env.AZURE_BLOB_CONNECTION_STRING,
        containerName: process.env.AZURE_BLOB_CONTAINER_NAME,
    } as AzureBlobServiceOptions,
    mongoOptions: {
        connectionString: process.env.MONGO_CONNECTION_STRING,
        dbName: process.env.MONGO_DATABASE_NAME,
    } as MongoOptions,
    redisOptions: {
        redisConnectionString: process.env.REDIS_CONNECTION_STRING,
    } as RedisOptions,
    migrationOptions: {
        definitionsTrimmedCollectionName: process.env.MONGO_COLLECTION_NAME,
    } as MigrationServiceOptions,
    appInsightsOptions: {
        connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    } as { connectionString: string },
};

export const validateAppConfig = (config: AppConfig, logService: LogService) => {
    logService.log('AppConfig.validateAppConfig', 'Validating app config');

    try {
        Object.entries(config).forEach(([domain, options]) => {
            for (const option in options) {
                if (
                    options[option as keyof typeof options] === undefined ||
                    !options[option as keyof typeof options]
                ) {
                    throw new Error(
                        `Missing required environment variable for ${domain}.${option}`
                    );
                }
            }
        });

        logService.log('AppConfig.validateAppConfig', 'App config valiated');
    } catch (err) {
        logService.error('AppConfig.validateAppConfig', 'Error validating app config', {
            exception: err as Error,
        });

        throw err;
    }
};
