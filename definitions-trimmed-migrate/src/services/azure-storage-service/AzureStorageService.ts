import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { DequeuedMessageItem, QueueClient, QueueServiceClient } from '@azure/storage-queue';
import throat from 'throat';

import { LogService } from '../log-service/LogService';
import { RedisService } from '../redis-service/RedisService';
import { AzureStorageOptions } from './types';

export class AzureStorageService {
    private blobServiceClient: BlobServiceClient;
    private containerClient: ContainerClient;
    private definitionsTrimmedQueueClient: QueueClient;
    private definitionsToLowercaseQueueClient: QueueClient;

    constructor(
        private options: AzureStorageOptions,
        private redisService: RedisService,
        private logService: LogService
    ) {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(
            this.options.blobConnectionString
        );

        this.containerClient = this.blobServiceClient.getContainerClient(
            this.options.blobContainerName
        );

        this.definitionsTrimmedQueueClient = QueueServiceClient.fromConnectionString(
            this.options.queueConnectionString,
            { retryOptions: { maxTries: 4 } }
        ).getQueueClient(this.options.queueName);

        this.definitionsToLowercaseQueueClient = QueueServiceClient.fromConnectionString(
            this.options.queueConnectionString,
            { retryOptions: { maxTries: 4 } }
        ).getQueueClient(this.options.queueDefinitionsToLowercaseName);
    }

    // probably should have been split with MigrationService
    public async iterateAndQueueBlobsByType(componentType: string) {
        const startTime = new Date();
        let totalIterated = 0;
        let totalQueued = 0;
        let nextContinuationToken = undefined;

        try {
            for await (const blobResponse of this.containerClient
                .listBlobsFlat({ prefix: componentType })
                .byPage({ maxPageSize: 1000, continuationToken: nextContinuationToken })) {
                const { continuationToken, segment } = blobResponse;
                const blobsNamesToProcess: string[] = [];

                if (continuationToken) {
                    nextContinuationToken = continuationToken;
                }

                if (segment.blobItems.length) {
                    const cachedBlobValues = await Promise.all(
                        segment.blobItems.map(
                            throat(50, (blob) => {
                                const { name } = blob;

                                return this.redisService.get(name);
                            })
                        )
                    );

                    cachedBlobValues.forEach((cachedBlobValue, i) => {
                        const { name, properties } = segment.blobItems[i];
                        const { lastModified } = properties;

                        if (lastModified < startTime && cachedBlobValue === null) {
                            blobsNamesToProcess.push(name);
                        }
                    });

                    if (blobsNamesToProcess.length) {
                        await Promise.all(
                            blobsNamesToProcess.map(
                                throat(50, (blobsNameToProcess) => {
                                    this.logService.log(
                                        'AzureStorageService.iterateAndQueueBlobsByType',
                                        `Queued ${blobsNameToProcess}`
                                    );

                                    totalQueued++;

                                    return this.queueMessage(blobsNameToProcess);
                                })
                            )
                        );

                        await Promise.all(
                            blobsNamesToProcess.map(
                                throat(50, (blobsNameToProcess) => {
                                    this.logService.log(
                                        'AzureStorageService.iterateAndQueueBlobsByType',
                                        `Set redis ${blobsNameToProcess}`
                                    );

                                    return this.redisService.set(blobsNameToProcess, 1);
                                })
                            )
                        );
                    }
                }

                totalIterated += segment.blobItems.length;

                this.logService.log(
                    'AzureStorageService.iterateAndQueueBlobsByType',
                    `Iterated ${totalIterated} total blobs and queued ${totalQueued} blobs to be processed.`
                );
            }

            console.log('done');
        } catch (err) {
            this.logService.error('AzureStorageService.iterateAndQueueAllBlobs', err, {
                exception: err as Error,
            });

            throw err;
        }
    }

    // probably should have been split with MigrationService
    public async iterateAndQueueAllBlobs() {
        const startTime = new Date();
        let i = 1;
        let queued = 0;

        try {
            for await (const blob of this.containerClient.listBlobsFlat()) {
                const { name, properties } = blob;
                const { lastModified } = properties;

                const cachedBlobName = await this.redisService.get(name);

                if (lastModified < startTime && cachedBlobName === null) {
                    await this.queueMessage(name);
                    await this.redisService.set(name, 1);

                    queued++;
                }

                this.logService.log(
                    'AzureStorageService.iterateAndQueueAllBlobs',
                    `Iterated ${i++} and queued ${queued} blobs to be processed.`
                );
            }
        } catch (err) {
            this.logService.error('AzureStorageService.iterateAndQueueAllBlobs', err, {
                exception: err as Error,
            });

            throw err;
        }
    }

    public async receiveMessages(count: number, client = 'definitionsTrimmedQueueClient') {
        try {
            if (client === 'definitionsTrimmedQueueClient') {
                return await this.definitionsTrimmedQueueClient.receiveMessages({
                    numberOfMessages: count,
                });
            } else if (client === 'definitionsToLowercaseQueueClient') {
                return await this.definitionsToLowercaseQueueClient.receiveMessages({
                    numberOfMessages: count,
                });
            }
        } catch (err) {
            this.logService.error('AzureStorageService.receiveMessages', err, {
                exception: err as Error,
            });
        }
    }

    public async queueMessage(message: string, client = 'definitionsTrimmedQueueClient') {
        try {
            if (client === 'definitionsTrimmedQueueClient') {
                // 900 seconds = 15 min timeout
                await this.definitionsTrimmedQueueClient.sendMessage(message, {
                    visibilityTimeout: 900,
                });
            } else if (client === 'definitionsToLowercaseQueueClient') {
                await this.definitionsToLowercaseQueueClient.sendMessage(message, {
                    visibilityTimeout: 900,
                });
            }
        } catch (err) {
            this.logService.error('AzureStorageService.queueMessage', err, {
                exception: err as Error,
            });
        }
    }

    public async deleteMessage(
        message: DequeuedMessageItem,
        client = 'definitionsTrimmedQueueClient'
    ) {
        const { messageId, popReceipt } = message;

        try {
            if (client === 'definitionsTrimmedQueueClient') {
                await this.definitionsTrimmedQueueClient.deleteMessage(messageId, popReceipt);
            } else if (client === 'definitionsToLowercaseQueueClient') {
                await this.definitionsToLowercaseQueueClient.deleteMessage(messageId, popReceipt);
            }
        } catch (err) {
            this.logService.error('AzureStorageService.deleteMessage', err, {
                exception: err as Error,
            });
        }
    }

    public async downloadBlob(blobName: string) {
        try {
            const blobClient = this.containerClient.getBlobClient(blobName);
            const downloadBlockBlobResponse = await blobClient.download();
            const readableBlob = (
                await this.streamToBuffer(downloadBlockBlobResponse.readableStreamBody)
            )?.toString();

            return JSON.parse(readableBlob as string);
        } catch (err) {
            this.logService.error('AzureStorageService.downloadBlob', err, {
                exception: err as Error,
            });

            throw err;
        }
    }

    private async streamToBuffer(
        stream: NodeJS.ReadableStream | undefined
    ): Promise<Buffer | null> {
        if (!stream) {
            return null;
        }

        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];

            stream.on('data', (data) => {
                chunks.push(data instanceof Buffer ? data : Buffer.from(data));
            });

            stream.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
            stream.on('error', reject);
        });
    }
}
