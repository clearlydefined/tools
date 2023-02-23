import { MongoService } from './services/mongo-service/MongoService';
import { RedisService } from './services/redis-service/RedisService';
import { MigrationService } from './services/migration-service/MigrationService';
import { AppConfig } from './config/types';
import { AzureBlobService } from './services/blob-service/BlobService';

export const app = async (config: AppConfig) => {
    let startTime = Date.now();

    const mongoService = new MongoService(config.mongoOptions);
    const redisService = new RedisService(config.redisOptions);
    const blobService = new AzureBlobService(config.azureBlobServiceOptions);
    const migrationService = new MigrationService(
        config.migrationOptions,
        mongoService,
        redisService,
        blobService
    );

    try {
        await mongoService.connect();
        await redisService.connect();

        await migrationService.start();
    } catch (err) {
        console.error(`App error - ${err}`);
    } finally {
        await mongoService.disconnect();
        await redisService.disconnect();

        console.log('Migration completed in', (Date.now() - startTime) / 1000, 'seconds');
    }
};
