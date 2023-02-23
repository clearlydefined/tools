import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

import { AzureBlobServiceOptions } from './types';

export class AzureBlobService {
    private blobServiceClient: BlobServiceClient;
    private containerClient: ContainerClient;

    constructor(private options: AzureBlobServiceOptions) {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(
            this.options.connectionString
        );

        this.containerClient = this.blobServiceClient.getContainerClient(
            process.env.AZURE_BLOB_CONTAINER_NAME!
        );
    }

    public async getAllBlobNames() {
        const blobNames: string[] = [];
        let i = 1;

        for await (const blob of this.containerClient.listBlobsFlat()) {
            blobNames.push(blob.name);
            console.log(`Iterated ${i++} blobs`);

            if (i === 100) break;
        }

        return blobNames;
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
            console.error(`AzureBlobService.downloadBlob - ${err}`);
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
