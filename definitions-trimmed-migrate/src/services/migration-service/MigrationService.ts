import { DequeuedMessageItem } from '@azure/storage-queue';

import { AppConfig } from '../../config/types';
import { sleep } from '../../utils/index';
import { AzureStorageService } from '../azure-storage-service/AzureStorageService';
import { LogService } from '../log-service/LogService';
import { MongoService } from '../mongo-service/MongoService';
import { RedisService } from '../redis-service/RedisService';
import { ComponentCoordinates, Definition, DefinitionBlob, MigrationServiceProcess } from './types';

export class MigrationService {
    private blobsMigrated = 0;

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

                    // Handles a rare edge-case where a blob was deleted
                    // after it was queued by the blob-iterator
                    if (!definitionBlob) {
                        const error = new Error(`Blob ${blobName} no longer exists`);

                        this.logService.error('RedisService.get', error, {
                            exception: error,
                        });

                        await this.markProcessed(blobName, message);

                        continue;
                    }

                    const { coordinates } = definitionBlob;
                    const _id = this.getIdFromCoordinates(coordinates);
                    const definitionAlreadyExists = await this.getDefinitionById(_id);

                    if (!definitionAlreadyExists) {
                        await this.storeDefinition(_id, definitionBlob);
                    }

                    await this.markProcessed(blobName, message);
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
        await this.redisService.set(blobName, 0);
        await this.azureStorageService.deleteMessage(message);

        this.logService.log(
            'MigrationService.processQueuedBlobs',
            `Processed ${blobName}. ${++this.blobsMigrated} total blobs have been processed`
        );
    }

    private async downloadBlob(blobName: string): Promise<DefinitionBlob> {
        return await this.azureStorageService.downloadBlob(blobName);
    }

    private async getQueuedMessages(batchSize: string) {
        return await this.azureStorageService.receiveMessages(Number(batchSize));
    }

    private async getDefinitionById(_id: string) {
        return await this.mongoService.findOne(this.options.mongoOptions.collectionName, {
            _id,
        });
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
        return `${type}/${provider}/${namespace ?? '-'}/${name}/${revision}`;
    }
}
