export enum MigrationServiceProcess {
    BlobIterator = 'blob_iterator',
    BlobProcessor = 'blob_processor',
    BatchBlobProcessor = 'blob_processor_batch',
    BlobIteratorByType = 'blob_iterator_by_type',
    RemoveUndefineds = 'remove_undefineds',
    FindUppercasedIds = 'find_uppercased_ids',
    DeleteQueuedUppercasedIds = 'delete_queued_uppercased_ids',
}

export type MigrationServiceOptions = {
    process: MigrationServiceProcess;
    componentType: string;
};

export type DefinitionTrimmed = Definition & {
    _id: string;
};

export type Definition = {
    _meta: {
        schemaVersion: string;
        updated: string;
    };
    coordinates: ComponentCoordinates;
    described: {
        files: number;
        hashes: {
            sha1: string;
            sha256: string;
        };
        projectWebsite: string;
        releaseDate: string;
        score: {
            date: number;
            source: number;
            total: number;
        };
        sourceLocation: {
            name: string;
            namespace: string;
            provider: string;
            revision: string;
            type: string;
            url: string;
        };
        tools: string[];
        toolScore: {
            date: number;
            source: number;
            total: number;
        };
        urls: {
            download: string;
            registry: string;
            version: string;
        };
    };
    licensed: {
        declared: string;
        facets: {
            core: {
                attribution: {
                    parties: string[];
                    unknown: number;
                };
                discovered: {
                    expressions: string[];
                    unknown: number;
                };
                files: number;
            };
        };
    };
    scores: {
        effective: number;
        tool: number;
    };
};

export type DefinitionBlob = Definition & {
    _mongo: {
        page: number;
        partitionKey: string;
        totalPages: number;
    };
    files: {
        attributions: string[];
        hashes: { [key: string]: string };
        license: string;
        path: string;
        natures: string[];
        token: string;
    };
};

export type DefinitionDocument = Definition & {
    _id: string;
};

export type ComponentCoordinates = {
    name: string;
    namespace: string;
    provider: string;
    revision: string;
    type: string;
};
