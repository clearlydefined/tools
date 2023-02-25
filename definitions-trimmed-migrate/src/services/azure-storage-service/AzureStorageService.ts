import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { DequeuedMessageItem, QueueClient, QueueServiceClient } from '@azure/storage-queue';

import { LogService } from '../log-service/LogService';
import { RedisService } from '../redis-service/RedisService';
import { AzureStorageOptions } from './types';

export class AzureStorageService {
    private blobServiceClient: BlobServiceClient;
    private containerClient: ContainerClient;
    private queueClient: QueueClient;

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

        this.queueClient = QueueServiceClient.fromConnectionString(
            this.options.queueConnectionString,
            { retryOptions: { maxTries: 4 } }
        ).getQueueClient(this.options.queueName);
    }

    public async iterateAndQueueAllBlobs() {
        const startTime = new Date();
        let i = 1;
        let queued = 0;

        try {
            for await (const blob of this.containerClient.listBlobsFlat()) {
                const { name, properties } = blob;
                const { lastModified } = properties;

                if (lastModified < startTime && !(await this.redisService.get(name))) {
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

    public async receiveMessages(count: number) {
        try {
            return await this.queueClient.receiveMessages({ numberOfMessages: count });
        } catch (err) {
            this.logService.error('AzureStorageService.peekQueue', err, {
                exception: err as Error,
            });
        }
    }

    private async queueMessage(message: string) {
        try {
            await this.queueClient.sendMessage(message);
        } catch (err) {
            this.logService.error('AzureStorageService.queueMessage', err, {
                exception: err as Error,
            });
        }
    }

    public async deleteMessage(message: DequeuedMessageItem) {
        const { messageId, popReceipt } = message;

        try {
            await this.queueClient.deleteMessage(messageId, popReceipt);
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
