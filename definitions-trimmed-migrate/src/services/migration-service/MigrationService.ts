import { DequeuedMessageItem } from '@azure/storage-queue';

import { AppConfig } from '../../config/types';
import { sleep } from '../../utils/index';
import { AzureStorageService } from '../azure-storage-service/AzureStorageService';
import { LogService } from '../log-service/LogService';
import { MongoService } from '../mongo-service/MongoService';
import { RedisService } from '../redis-service/RedisService';
import { ComponentCoordinates, Definition, DefinitionBlob, MigrationServiceProcess } from './types';

export class MigrationService {
    constructor(
        private options: AppConfig,
        private mongoService: MongoService,
        private redisService: RedisService,
        private azureStorageService: AzureStorageService,
        private logService: LogService
    ) {}

    public async start(process: MigrationServiceProcess) {
        this.logService.log('MigrationService.start', `Starting ${process}`);

        try {
            switch (process) {
                case MigrationServiceProcess.BlobIterator:
                    await this.azureStorageService.iterateAndQueueAllBlobs();

                case MigrationServiceProcess.BlobProcessor:
                    await this.processQueuedBlobs();

                default:
                    throw new Error('Invalid Migration process name');
            }
        } catch (err) {
            this.logService.error('MigrationService.start', err, {
                exception: err as Error,
            });

            throw err;
        }
    }

    private async processQueuedBlobs() {
        const migrationStartTime = Date.now();
        let blobsMigrated = 0;

        this.logService.log(
            'MigrationService.processQueuedBlobs',
            'Starting to process queued blobs'
        );

        while (true) {
            const queuedMessages = await this.getQueuedMessages(
                this.options.azureStorageOptions.queueDequeueBatchSize
            );

            if (queuedMessages?.receivedMessageItems?.length) {
                const { receivedMessageItems } = queuedMessages;

                for (const message of receivedMessageItems) {
                    const blobName = message.messageText;

                    const definitionBlob = await this.downloadBlob(blobName);
                    const { _meta, coordinates } = definitionBlob;

                    if (!this.wasUpdatedAfterMigrationStart(migrationStartTime, _meta.updated)) {
                        const _id = this.getIdFromCoordinates(coordinates);

                        await this.storeDefinition(_id, definitionBlob);
                    }

                    await this.markProcessed(blobName, message);

                    this.logService.log(
                        'MigrationService.processQueuedBlobs',
                        `Processed ${blobName}. ${++blobsMigrated} total blobs have been processed`
                    );
                }
            } else {
                this.logService.log(
                    'MigrationService.processQueuedBlobs',
                    `No blobs in queue. Sleeping for a few seconds then retrying ...zZZzzZZz...`
                );

                await sleep(10000);
            }
        }
    }

    private async markProcessed(blobName: string, message: DequeuedMessageItem) {
        await this.redisService.delete(blobName);
        await this.azureStorageService.deleteMessage(message);
    }

    private async downloadBlob(blobName: string): Promise<DefinitionBlob> {
        return await this.azureStorageService.downloadBlob(blobName);
    }

    private async getQueuedMessages(batchSize: string) {
        return await this.azureStorageService.receiveMessages(Number(batchSize));
    }

    private wasUpdatedAfterMigrationStart(migrationStartTime: number, lastUpdatedDate: string) {
        return Date.parse(lastUpdatedDate) > migrationStartTime;
    }

    private async storeDefinition(_id: string, definitionBlob: DefinitionBlob) {
        const { _meta, coordinates, described, licensed, scores } = definitionBlob;

        await this.mongoService.upsert(this.options.mongoOptions.collectionName, { _id }, {
            _id,
            _meta,
            coordinates,
            described,
            licensed,
            scores,
        } as Definition);
    }

    private getIdFromCoordinates(coordinates: ComponentCoordinates) {
        const { type, provider, namespace, name, revision } = coordinates;
        return `${type}/${provider}/${namespace}/${name}/${revision}`;
    }
}
