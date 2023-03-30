import { Db, MongoClient, Sort } from 'mongodb';

import { LogService } from '../log-service/LogService';
import { MongoOptions } from './types';
import { DefinitionTrimmed } from '../migration-service/types';

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
            this.logService.error('MongoService.connect', err, {
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
            this.logService.error('MongoService.disconnect', err, {
                exception: err as Error,
            });

            throw err;
        }
    }

    public async find<T>(collection: string, query: Object = {}, sort: Sort, limit = 100) {
        const results: DefinitionTrimmed[] = [];
        let count = 0;

        try {
            const cursor = this.db.collection(collection).find<T>(query).sort(sort).limit(limit);

            await cursor.forEach((d: any) => {
                results.push(d);
                console.log(`Processed ${++count} - ${d._id}`);
            });

            return results;
        } catch (err) {
            this.logService.error('MongoService.find', err, {
                exception: err as Error,
            });

            throw err;
        }
    }

    public async findPaged<DefinitionTrimmed>(
        collection: string,
        query: Object = {},
        sort: Sort = { _id: 1 },
        limit: number = 100
    ) {
        const results: DefinitionTrimmed[] = [];
        let count = 0;

        try {
            const cursor = this.db
                .collection(collection)
                .find<DefinitionTrimmed>(query)
                .sort(sort)
                .limit(limit);

            await cursor.forEach((d: any) => {
                results.push(d);
                console.log(`Found ${++count} - ${d._id}`);
            });

            return results;
        } catch (err) {
            this.logService.error('MongoService.findPaged', err, {
                exception: err as Error,
            });

            throw err;
        }
    }

    public async findOne<T>(collection: string, query: Object) {
        try {
            return await this.db.collection(collection).findOne<T>(query);
        } catch (err) {
            this.logService.error('MongoService.findOne', err, {
                exception: err as Error,
            });

            throw err;
        }
    }

    public async storeOne<T>(collection: string, data: T) {
        try {
            await this.db.collection(collection).insertOne(data);
        } catch (err) {
            this.logService.error('MongoService.storeOne', err, {
                exception: err as Error,
            });

            throw err;
        }
    }

    public async upsert<T>(collection: string, query: any, data: T) {
        try {
            await this.db.collection(collection).updateOne(query, { $set: data }, { upsert: true });
        } catch (err) {
            this.logService.error('MongoService.upsert', err, {
                exception: err as Error,
            });

            throw err;
        }
    }

    public async deleteOne<T>(collection: string, filter: Object) {
        try {
            return await this.db.collection(collection).deleteOne(filter);
        } catch (err) {
            this.logService.error('MongoService.deleteOne', err, {
                exception: err as Error,
            });

            throw err;
        }
    }

    // public async updateOne<T>(collection: string, filter: Object) {
    //     try {
    //         return await this.db.collection(collection).updateOne(filter);
    //     } catch (err) {
    //         this.logService.error('MongoService.deleteOne', err, {
    //             exception: err as Error,
    //         });

    //         throw err;
    //     }
    // }
}
