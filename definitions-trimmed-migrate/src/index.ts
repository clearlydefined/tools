require('dotenv').config();

import { app } from './app';
import { AppConfig } from './config/types';
import { config, validateAppConfig } from './config';
import { LogService } from './services/log-service/LogService';
import { EventTelemetry } from 'applicationinsights/out/Declarations/Contracts/index';

export const run = async (config: AppConfig) => {
    const logService = new LogService();

    logService.log('App', 'Starting app', {} as EventTelemetry);

    try {
        validateAppConfig(config, logService);

        await app(config, logService);
    } catch (err) {
        logService.log('App', 'App stopping due to error', {} as EventTelemetry);
    }
};

run(config);
