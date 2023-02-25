import { TelemetryClient, setup, defaultClient } from 'applicationinsights';
import {
    EventTelemetry,
    ExceptionTelemetry,
} from 'applicationinsights/out/Declarations/Contracts/index';

export class LogService {
    private client: TelemetryClient;

    constructor() {
        setup().start;

        this.client = defaultClient;
    }

    public log(context: string, text: string, telemetry?: EventTelemetry) {
        console.log(context, '-', text);

        if (telemetry) {
            this.logEvent(context, text, telemetry);
        }
    }

    public error(context: string, err: any, telemetry?: ExceptionTelemetry, properties?: any) {
        console.error(`${context} - ${err}`);

        if (telemetry) {
            this.logException(context, telemetry, properties);
        }
    }

    public logEvent(context: string, text: string, telemetry: EventTelemetry) {
        const { properties } = telemetry;

        this.client.trackEvent({ name: context, properties: { ...properties, text } });
    }

    public logException(context: string, telemetry: ExceptionTelemetry, properties: any) {
        const { exception } = telemetry;

        this.client.trackException({ exception, properties: { ...properties, name: context } });
    }
}
