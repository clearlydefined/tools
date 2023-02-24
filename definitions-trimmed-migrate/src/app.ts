import { MongoService } from './services/mongo-service/MongoService';
import { RedisService } from './services/redis-service/RedisService';
import { MigrationService } from './services/migration-service/MigrationService';
import { AppConfig } from './config/types';
import { AzureBlobService } from './services/blob-service/BlobService';
import { LogService } from './services/log-service/LogService';

export const app = async (config: AppConfig, logService: LogService) => {
    let startTime = Date.now();

    const mongoService = new MongoService(config.mongoOptions, logService);
    const redisService = new RedisService(config.redisOptions, logService);
    const blobService = new AzureBlobService(config.azureBlobServiceOptions, logService);
    const migrationService = new MigrationService(
        config.migrationOptions,
        mongoService,
        redisService,
        blobService,
        logService
    );

    try {
        await mongoService.connect();
        await redisService.connect();
        await migrationService.start();
    } catch (err) {
        logService.error('App', 'Exception', { exception: err as Error });
    } finally {
        await mongoService.disconnect();
        await redisService.disconnect();

        logService.log('App', `Migration completed in ${(Date.now() - startTime) / 1000} seconds`);
    }
};
