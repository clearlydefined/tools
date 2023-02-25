import { RedisClientType, createClient } from '@redis/client';

import { RedisOptions } from './types';
import { LogService } from '../log-service/LogService';

export class RedisService {
    private redisClient: RedisClientType;

    constructor(private options: RedisOptions, private logService: LogService) {
        const { url, password } = this.options;

        this.redisClient = createClient({ url, password });

        this.redisClient.on('error', (err) => {
            this.logService.error('RedisService.error', err, {
                exception: err as Error,
            });
        });
    }

    public async connect() {
        try {
            await this.redisClient.connect();

            this.logService.log('RedisService.connect', 'Connected to Redis');
        } catch (err) {
            this.logService.error('RedisService.connect', err, {
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
            this.logService.error('RedisService.connect', err, {
                exception: err as Error,
            });

            throw err;
        }
    }

    public async get(key: string) {
        try {
            return await this.redisClient.get(key);
        } catch (err) {
            this.logService.error('RedisService.get', err, {
                exception: err as Error,
            });
        }
    }

    public async set(key: string, value: number) {
        try {
            await this.redisClient.set(key, value);
        } catch (err) {
            this.logService.error('RedisService.set', err, {
                exception: err as Error,
            });
        }
    }

    public async delete(key: string) {
        try {
            await this.redisClient.del(key);
        } catch (err) {
            this.logService.error('RedisService.delete', err, {
                exception: err as Error,
            });
        }
    }
}
