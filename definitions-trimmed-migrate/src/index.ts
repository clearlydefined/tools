require('dotenv').config();

import express from 'express';
import { EventTelemetry } from 'applicationinsights/out/Declarations/Contracts/index';

import { app } from './app';
import { AppConfig } from './config/types';
import { config, validateAppConfig } from './config';
import { LogService } from './services/log-service/LogService';

export const run = async (config: AppConfig) => {
    const logService = new LogService();
    const expressApp = express();

    logService.log('App', 'Starting app', {} as EventTelemetry);

    try {
        validateAppConfig(config, logService);

        // Needed to keep Azure App Service alive, unfortunately...
        expressApp.use('/', (_, res) => res.sendStatus(200));

        expressApp.listen(config.expressOptions.port);

        await app(config, logService);
    } catch (err) {
        logService.log('App', 'App stopping due to error', { properties: err } as EventTelemetry);
    }
};

run(config);
