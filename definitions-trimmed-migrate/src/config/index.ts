import { AzureStorageOptions } from '../services/azure-storage-service/types';
import { LogService } from '../services/log-service/LogService';
import { MongoOptions } from '../services/mongo-service/types';
import { RedisOptions } from '../services/redis-service/types';
import { AppConfig } from './types';

export const config: AppConfig = {
    azureStorageOptions: {
        queueConnectionString: process.env.AZURE_QUEUE_CONNECTION_STRING,
        queueName: process.env.AZURE_QUEUE_NAME,
        queueDequeueBatchSize: process.env.AZURE_QUEUE_DEQUEUE_BATCH_SIZE,
        blobConnectionString: process.env.AZURE_BLOB_CONNECTION_STRING,
        blobContainerName: process.env.AZURE_BLOB_CONTAINER_NAME,
    } as AzureStorageOptions,
    mongoOptions: {
        connectionString: process.env.MONGO_CONNECTION_STRING,
        dbName: process.env.MONGO_DATABASE_NAME,
        collectionName: process.env.MONGO_COLLECTION_NAME,
    } as MongoOptions,
    redisOptions: {
        url: process.env.REDIS_URL,
        password: process.env.REDIS_PASSWORD,
    } as RedisOptions,
    appInsightsOptions: {
        connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    } as { connectionString: string },
    expressOptions: { port: process.env.PORT } as { port: number | string },
    migrationOptions: { process: process.env.MIGRATION_PROCESS } as { process: string },
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
        logService.error('AppConfig.validateAppConfig', err, {
            exception: err as Error,
        });

        throw err;
    }
};
