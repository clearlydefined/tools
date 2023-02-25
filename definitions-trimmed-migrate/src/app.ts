import { MongoService } from './services/mongo-service/MongoService';
import { RedisService } from './services/redis-service/RedisService';
import { MigrationService } from './services/migration-service/MigrationService';
import { AppConfig } from './config/types';
import { AzureStorageService } from './services/azure-storage-service/AzureStorageService';
import { LogService } from './services/log-service/LogService';
import { MigrationServiceProcess } from './services/migration-service/types';

export const app = async (config: AppConfig, logService: LogService) => {
    const startTime = Date.now();
    const mongoService = new MongoService(config.mongoOptions, logService);
    const redisService = new RedisService(config.redisOptions, logService);
    const azureStorageService = new AzureStorageService(
        config.azureStorageOptions,
        redisService,
        logService
    );
    const migrationService = new MigrationService(
        config,
        mongoService,
        redisService,
        azureStorageService,
        logService
    );

    try {
        await mongoService.connect();
        await redisService.connect();

        await migrationService.start(config.migrationOptions.process as MigrationServiceProcess);
    } catch (err) {
        logService.error('App.Exception', err, { exception: err as Error });
    } finally {
        await mongoService.disconnect();
        await redisService.disconnect();

        logService.log('App', `Migration completed in ${(Date.now() - startTime) / 1000} seconds`);

        process.kill(process.pid, 'SIGINT');
    }
};
