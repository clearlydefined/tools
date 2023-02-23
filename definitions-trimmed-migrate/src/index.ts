require('dotenv').config();

import { app } from './app';
import { AppConfig } from './config/types';
import { config, validateAppConfig } from './config';

export const run = async (config: AppConfig) => {
    console.log('Starting app');

    try {
        validateAppConfig(config);

        await app(config);
    } catch (err) {
        console.error('App stopping due to error', err);
    }
};

run(config);
