import { AzureBlobService } from '../blob-service/BlobService';
import { LogService } from '../log-service/LogService';
import { MongoService } from '../mongo-service/MongoService';
import { RedisService } from '../redis-service/RedisService';
import {
    ComponentCoordinates,
    Definition,
    DefinitionBlob,
    DefinitionDocument,
    MigrationServiceOptions,
} from './types';

export class MigrationService {
    constructor(
        private options: MigrationServiceOptions,
        private mongoService: MongoService,
        private redisService: RedisService,
        private blobService: AzureBlobService,
        private logService: LogService
    ) {}

    public async start() {
        this.logService.log('MigrationService.start', 'Starting Migration service');

        try {
            const blobNames = await this.blobService.getAllBlobNames();

            await this.migrateBlobsToTrimmed(blobNames);
        } catch (err) {
            this.logService.error(
                'MigrationService.start',
                'Failed to migrate blobs to definitions-trimmed',
                {
                    exception: err as Error,
                }
            );

            throw err;
        }
    }

    private async migrateBlobsToTrimmed(blobNames: string[]) {
        const migrationStartTime = Date.now();

        this.logService.log(
            'MigrationService.migrateBlobsToTrimmed',
            `Migrating ${blobNames.length} definition blobs to definitions-trimmed`
        );

        let blobsMigrated = 0;

        for (const blobName of blobNames) {
            const processed = await this.redisService.get(blobName);

            if (processed) continue;

            const definitionBlob: DefinitionBlob = await this.blobService.downloadBlob(blobName);

            if (
                this.wasUpdatedAfterMigrationStart(migrationStartTime, definitionBlob._meta.updated)
            ) {
                await this.redisService.set(blobName, 1);
                continue;
            }

            const _id = this.getIdFromCoordinates(definitionBlob.coordinates);
            const definitionDocument = await this.getDefinitionById(_id);

            if (!definitionDocument) {
                await this.storeDefinition(_id, definitionBlob);
            }

            this.logService.log(
                'MigrationService.migrateBlobsToTrimmed',
                `Processed ${++blobsMigrated}/${blobNames.length} blobs`
            );

            await this.redisService.set(blobName, 1);
        }
    }

    private wasUpdatedAfterMigrationStart(migrationStartTime: number, lastUpdatedDate: string) {
        return Date.parse(lastUpdatedDate) > migrationStartTime;
    }

    private async storeDefinition(id: string, definitionBlob: DefinitionBlob) {
        const { _meta, coordinates, described, licensed, scores } = definitionBlob;

        await this.mongoService.storeOne(this.options.definitionsTrimmedCollectionName, {
            _id: id,
            _meta,
            coordinates,
            described,
            licensed,
            scores,
        } as Definition);
    }

    private async getDefinitionById(id: string) {
        return await this.mongoService.findOne<DefinitionDocument>(
            this.options.definitionsTrimmedCollectionName,
            { _id: id }
        );
    }

    private getIdFromCoordinates(coordinates: ComponentCoordinates) {
        const { type, provider, namespace, name, revision } = coordinates;
        return `${type}/${provider}/${namespace}/${name}/${revision}`;
    }
}
