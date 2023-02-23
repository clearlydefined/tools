import { Db, MongoClient } from 'mongodb';

import { MongoOptions } from './types';

export class MongoService {
    private client: MongoClient;
    private db: Db;

    constructor(private options: MongoOptions) {
        this.client = new MongoClient(this.options.connectionString);
        this.db = this.client.db(this.options.dbName);
    }

    public async connect() {
        try {
            await this.client.connect();

            console.log('Connected to MongoDB');
        } catch (err) {
            console.error('Failed to connect to MongoDB');
            console.error(err);

            throw err;
        }
    }

    public async disconnect() {
        try {
            await this.client.close();

            console.log('Disconnected from MongoDB');
        } catch (err) {
            console.error('Failed to disconnect from MongoDB');
            console.error(err);
        }
    }

    public async findOne<T>(collection: string, query: Object) {
        try {
            const document = await this.db.collection(collection).findOne<T>(query);

            return document;
        } catch (err) {
            console.error(`MongoService.get - ${err}`);
            throw err;
        }
    }

    public async storeOne<T>(collection: string, data: T) {
        try {
            await this.db.collection(collection).insertOne(data);
        } catch (err) {
            console.error(`MongoService.store - ${err}`);
            throw err;
        }
    }
}
