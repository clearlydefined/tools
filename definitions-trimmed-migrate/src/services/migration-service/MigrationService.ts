import { DequeuedMessageItem } from '@azure/storage-queue';
import throat from 'throat';

import { AppConfig } from '../../config/types';
import { sleep } from '../../utils/index';
import { AzureStorageService } from '../azure-storage-service/AzureStorageService';
import { LogService } from '../log-service/LogService';
import { MongoService } from '../mongo-service/MongoService';
import { RedisService } from '../redis-service/RedisService';
import {
    ComponentCoordinates,
    Definition,
    DefinitionBlob,
    DefinitionTrimmed,
    MigrationServiceOptions,
    MigrationServiceProcess,
} from './types';

export class MigrationService {
    private blobsMigrated = 0;

    constructor(
        private options: AppConfig,
        private mongoService: MongoService,
        private redisService: RedisService,
        private azureStorageService: AzureStorageService,
        private logService: LogService
    ) {}

    public async start(options: MigrationServiceOptions) {
        const { process, componentType } = options;

        this.logService.log('MigrationService.start', `Starting ${process}`);

        try {
            switch (process) {
                case MigrationServiceProcess.BlobIterator:
                    await this.azureStorageService.iterateAndQueueAllBlobs();
                    break;

                case MigrationServiceProcess.BlobProcessor:
                    await this.processQueuedBlobs();
                    break;

                case MigrationServiceProcess.BatchBlobProcessor:
                    await this.processQueuedBlobsBatch();
                    break;

                case MigrationServiceProcess.RemoveUndefineds:
                    await this.removeUndefineds();
                    break;

                case MigrationServiceProcess.FindUppercasedIds:
                    await this.findUppercasedIds();
                    break;

                case MigrationServiceProcess.BlobIteratorByType:
                    await this.azureStorageService.iterateAndQueueBlobsByType(componentType);
                    break;

                case MigrationServiceProcess.DeleteQueuedUppercasedIds:
                    await this.deleteQueuedUppercasedIds();
                    break;

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

    private async findUppercasedIds() {
        const limit = 10000;
        const { componentType } = this.options.migrationOptions;
        let processed = 0;
        let lastId = componentType;

        while (true) {
            const definitions = await this.mongoService.findPaged<DefinitionTrimmed>(
                'definitions-trimmed',
                {
                    _id: { $gt: lastId },
                    'coordinates.type': this.options.migrationOptions.componentType,
                },
                { _id: 1 },
                limit
            );

            if (!definitions.length) {
                processed += definitions.length;
                console.log('done');
                break;
            }
            const definitionsWithUppercase = definitions.filter(({ _id }) => /[A-Z]/.test(_id));

            if (definitionsWithUppercase.length) {
                await this.queueDefinitionsToLowercase(definitionsWithUppercase);
            }

            processed += definitions.length;
            lastId = definitions[definitions.length - 1]._id;

            console.log('Processed', processed, 'definitions');
        }
    }

    private async queueDefinitionsToLowercase(definitions: DefinitionTrimmed[]) {
        await Promise.all(
            definitions.map(
                throat(50, (definition) => {
                    const { _id } = definition;

                    return this.azureStorageService.queueMessage(
                        _id,
                        'definitionsToLowercaseQueueClient'
                    );
                })
            )
        );
    }

    private async deleteQueuedUppercasedIds() {
        this.logService.log(
            'MigrationService.deleteQueuedUppercasedIds',
            'Starting to process queued blobs'
        );

        const batchSize = this.options.azureStorageOptions.queueDequeueBatchSize;
        let count = 0;

        while (true) {
            const queuedDefinitionIdsToDelete = await this.getQueuedMessages(
                batchSize,
                'definitionsToLowercaseQueueClient'
            );

            if (queuedDefinitionIdsToDelete?.receivedMessageItems?.length) {
                const { receivedMessageItems } = queuedDefinitionIdsToDelete;

                // cache uppercased ids we're about to delete in redis
                await Promise.all(
                    receivedMessageItems.map(
                        throat(Number(batchSize), (receivedMessageItem) => {
                            const { messageText: definitionId } = receivedMessageItem;

                            return this.redisService.set(`deleting:${definitionId}`, 1);
                        })
                    )
                );

                // delete the uppercased ids from mongo
                await Promise.all(
                    receivedMessageItems.map(
                        throat(Number(batchSize), (receivedMessageItem) => {
                            const { messageText: definitionId } = receivedMessageItem;

                            console.log(`deleting - ${definitionId}`);

                            return this.mongoService.deleteOne('definitions-trimmed', {
                                _id: definitionId,
                            });
                        })
                    )
                );

                // queue ids to be reprocessed as lowercased
                await Promise.all(
                    receivedMessageItems.map(
                        throat(Number(batchSize), (receivedMessageItem) => {
                            const { messageText: definitionId } = receivedMessageItem;

                            console.log(`queuing - ${definitionId.toLowerCase()}`);

                            return this.azureStorageService.queueMessage(
                                definitionId.toLowerCase(),
                                'definitionsTrimmedQueueClient'
                            );
                        })
                    )
                );

                // cache to be processed
                await Promise.all(
                    receivedMessageItems.map(
                        throat(Number(batchSize), (receivedMessageItem) => {
                            const { messageText: definitionId } = receivedMessageItem;

                            console.log(`caching - ${definitionId.toLowerCase()}`);

                            return this.redisService.set(definitionId.toLowerCase(), 1);
                        })
                    )
                );

                // delete from definitionsToLowercaseQueueClient queue
                await Promise.all(
                    receivedMessageItems.map(
                        throat(Number(batchSize), (receivedMessageItem) => {
                            const { messageText: definitionId } = receivedMessageItem;

                            console.log('deleting from uppercase queue - ', definitionId);

                            return this.azureStorageService.deleteMessage(
                                receivedMessageItem,
                                'definitionsToLowercaseQueueClient'
                            );
                        })
                    )
                );

                count += receivedMessageItems.length;

                console.log(`Queued ${count} blobs to be processed`);
            } else {
                this.logService.log(
                    'MigrationService.deleteQueuedUppercasedIds',
                    `No blobs in queue. Sleeping for a few seconds then retrying ...zZZzzZZz...`
                );

                await sleep(10000);
            }
        }
    }

    private async removeUndefineds() {
        const limit = 1000;
        let processed = 0;
        let lastId = 'gem/rubygems/-/cld/0.12.0';

        while (true) {
            const definitions = await this.mongoService.findPaged<DefinitionTrimmed>(
                'definitions-trimmed',
                {
                    _id: {
                        $gte: lastId,
                    },
                    'coordinates.type': this.options.migrationOptions.componentType,
                    'coordinates.namespace': {
                        $exists: false,
                    },
                },
                { _id: 1 },
                limit
            );

            if (!definitions.length) {
                console.log('done');
                break;
            }

            await this.deleteDefintiions(definitions.filter((d) => d._id.includes('/undefined/')));

            processed += definitions.length;
            lastId = definitions[definitions.length - 1]._id;

            console.log('Processed', processed, 'definitions');
        }
    }

    private async deleteDefintiions(definitionsToDelete: DefinitionTrimmed[]) {
        let count = 0;

        try {
            await Promise.all(
                definitionsToDelete.map(
                    throat(50, (definitionToDelete) => {
                        console.log(`deleting - count: ${++count} - ${definitionToDelete._id}`);

                        return this.mongoService.deleteOne('definitions-trimmed', {
                            _id: definitionToDelete._id,
                        });
                    })
                )
            );
        } catch (err) {
            await this.deleteDefintiions(definitionsToDelete);
        }
    }

    private getBlobNameFromId(id: string) {
        const split = id.split('/');
        const version = split.pop();

        split.push('revision', `${version}.json`);

        const blobName = split.join('/');

        return blobName;
    }

    private async processQueuedBlobsBatch() {
        this.logService.log(
            'MigrationService.processQueuedBlobsBatch',
            'Starting to process queued blobs batch'
        );

        const batchSize = this.options.azureStorageOptions.queueDequeueBatchSize;

        while (true) {
            const queuedMessages = await this.getQueuedMessages(
                this.options.azureStorageOptions.queueDequeueBatchSize,
                'definitionsTrimmedQueueClient'
            );

            if (queuedMessages?.receivedMessageItems?.length) {
                const { receivedMessageItems } = queuedMessages;

                const filteredMessages = receivedMessageItems.filter(
                    (m) => !m.messageText.includes('/undefined/')
                );

                const batchedDefinitionBlobs: DefinitionBlob[] = await Promise.all(
                    filteredMessages.map(
                        throat(Number(batchSize), (message) => {
                            const id = message.messageText;
                            const blobName = this.getBlobNameFromId(id);

                            return this.downloadBlob(blobName);
                        })
                    )
                );

                const batchedIds = batchedDefinitionBlobs.map((b) =>
                    this.getIdFromCoordinates(b.coordinates)
                );

                const batchedDefinitions = await Promise.all(
                    batchedIds.map(throat(Number(batchSize), (id) => this.getDefinitionById(id)))
                );

                const nonExistingDefinitionIndexes: { _id: string; index: number }[] = [];
                const existingDefinitionIndexes: number[] = [];

                batchedDefinitions.forEach((batchedDefinition, index) => {
                    if (!batchedDefinition) {
                        nonExistingDefinitionIndexes.push({ _id: batchedIds[index], index });
                    } else {
                        existingDefinitionIndexes.push(index);
                    }
                });

                await Promise.all(
                    nonExistingDefinitionIndexes.map(
                        throat(Number(batchSize), ({ _id, index }) =>
                            this.storeDefinition(_id, batchedDefinitionBlobs[index])
                        )
                    )
                );

                await Promise.all(
                    receivedMessageItems.map(
                        throat(Number(batchSize), (message) => {
                            const { messageText: blobName } = message;

                            return this.markProcessed(blobName, message);
                        })
                    )
                );
            } else {
                this.logService.log(
                    'MigrationService.processQueuedBlobsBatch',
                    `No blobs in queue. Sleeping for a few seconds then retrying ...zZZzzZZz...`
                );

                await sleep(10000);
            }
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

    private async markProcessed(key: string, message: DequeuedMessageItem) {
        await this.redisService.delete(key);
        await this.azureStorageService.deleteMessage(message);

        this.logService.log(
            'MigrationService.markProcessed',
            `Processed ${key}. ${++this.blobsMigrated} total blobs have been processed`
        );
    }

    private async downloadBlob(blobName: string): Promise<DefinitionBlob> {
        return await this.azureStorageService.downloadBlob(blobName);
    }

    private async getQueuedMessages(batchSize: string, client = 'definitionsTrimmedQueueClient') {
        return await this.azureStorageService.receiveMessages(Number(batchSize), client);
    }

    private async getDefinitionById(_id: string) {
        return await this.mongoService.findOne<DefinitionTrimmed>(
            this.options.mongoOptions.collectionName,
            {
                _id: _id.toLowerCase(),
            }
        );
    }

    private async storeDefinition(_id: string, definitionBlob: DefinitionBlob) {
        const { _meta, coordinates, described, licensed, scores } = definitionBlob;

        try {
            await this.mongoService.upsert(this.options.mongoOptions.collectionName, { _id }, {
                _id: _id.toLowerCase(),
                _meta,
                coordinates,
                described,
                licensed,
                scores,
            } as Definition);
        } catch (err) {
            console.log('Most likely a duplicate key error:', err);
        }
    }

    private getIdFromCoordinates(coordinates: ComponentCoordinates) {
        const { type, provider, namespace, name, revision } = coordinates;
        return `${type}/${provider}/${namespace ?? '-'}/${name}/${revision}`.toLowerCase();
    }
}
