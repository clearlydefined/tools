import { createClient } from 'redis';
import { RedisClientType } from '@redis/client';

import { RedisOptions } from './types';
import { LogService } from '../log-service/LogService';

export class RedisService {
    private redisClient: RedisClientType;

    constructor(private options: RedisOptions, private logService: LogService) {
        this.redisClient = createClient({ url: this.options.redisConnectionString });
    }

    public async connect() {
        try {
            await this.redisClient.connect();

            this.logService.log('RedisService.connect', 'Connected to Redis');
        } catch (err) {
            this.logService.error('RedisService.connect', 'Failed to connect to Redis', {
                exception: err as Error,
            });

            throw err;
        }
    }

    public async disconnect() {
        try {
            await this.redisClient.disconnect();

            this.logService.log('RedisService.disconnect', 'Disconnected from Redis');
        } catch (err) {
            this.logService.error('RedisService.connect', 'Failed to disconnect from Redis', {
                exception: err as Error,
            });

            throw err;
        }
    }

    public async get(key: string) {
        try {
            return await this.redisClient.get(key);
        } catch (err) {
            this.logService.error('RedisService.get', 'Failed to get key', {
                exception: err as Error,
            });
        }
    }

    public async set(key: string, value: number) {
        try {
            await this.redisClient.set(key, value);
        } catch (err) {
            this.logService.error('RedisService.set', 'Failed to set key and value', {
                exception: err as Error,
            });
        }
    }
}
