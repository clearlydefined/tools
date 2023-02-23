import { createClient } from 'redis';
import { RedisClientType } from '@redis/client';

import { RedisOptions } from './types';

export class RedisService {
    private redisClient: RedisClientType;

    constructor(private options: RedisOptions) {
        this.redisClient = createClient({ url: this.options.redisConnectionString });
    }

    public async connect() {
        try {
            await this.redisClient.connect();

            console.log('Connected to Redis');
        } catch (err) {
            console.log('Failed to connect to Redis');
            console.error(err);
        }
    }

    public async disconnect() {
        try {
            await this.redisClient.disconnect();

            console.log('Disconnected from Redis');
        } catch (err) {
            console.error('Failed to disconnect from Redis');
            console.error(err);
        }
    }

    public async get(key: string) {
        return await this.redisClient.get(key);
    }
}
