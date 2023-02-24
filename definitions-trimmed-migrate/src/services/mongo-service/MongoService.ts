import { Db, MongoClient } from 'mongodb';

import { LogService } from '../log-service/LogService';
import { MongoOptions } from './types';

export class MongoService {
    private client: MongoClient;
    private db: Db;

    constructor(private options: MongoOptions, private logService: LogService) {
        this.client = new MongoClient(this.options.connectionString);
        this.db = this.client.db(this.options.dbName);
    }

    public async connect() {
        try {
            await this.client.connect();

            this.logService.log('MongoService.connect', 'Connected to MongoDB');
        } catch (err) {
            this.logService.error('MongoService.connect', 'Failed to connect to MongoDB', {
                exception: err as Error,
            });

            throw err;
        }
    }

    public async disconnect() {
        try {
            await this.client.close();

            this.logService.log('MongoService.disconnect', 'Disconnected from MongoDB');
        } catch (err) {
            this.logService.error('MongoService.disconnect', 'Failed to disconnect from MongoDB', {
                exception: err as Error,
            });

            throw err;
        }
    }

    public async findOne<T>(collection: string, query: Object) {
        try {
            return await this.db.collection(collection).findOne<T>(query);
        } catch (err) {
            this.logService.error('MongoService.findOne', 'Failed to findOne', {
                exception: err as Error,
            });

            throw err;
        }
    }

    public async storeOne<T>(collection: string, data: T) {
        try {
            await this.db.collection(collection).insertOne(data);
        } catch (err) {
            this.logService.error('MongoService.storeOne', 'Failed to storeOne', {
                exception: err as Error,
            });

            throw err;
        }
    }
}
