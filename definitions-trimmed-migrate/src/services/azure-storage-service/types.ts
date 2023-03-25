export type AzureStorageOptions = {
    queueConnectionString: string;
    queueName: string;
    queueDefinitionsToLowercaseName: string;
    queueDequeueBatchSize: string;
    blobConnectionString: string;
    blobContainerName: string;
};
