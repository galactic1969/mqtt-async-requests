/// <reference types="node" />
import * as Mqtt from 'mqtt';
export interface IfMqttRequest {
    client: Mqtt.Client | null;
    connectOptions: Mqtt.IClientOptions;
    requestParams: {
        topic?: string;
        responseTopicSuffix?: string;
        appendUuid?: boolean;
        payload?: string | Buffer;
        qos?: 0 | 1 | 2;
    };
    do(topic: string, appendUuid: boolean, responseTopicSuffix: string, payload: string | Buffer, qos: 0 | 1 | 2, requestTimeoutMilliseconds: number): Promise<Buffer>;
}
declare class BaseError extends Error {
    constructor(e?: string);
}
export declare class TimeoutCancelledBeforeExecution extends BaseError {
}
export declare class ResponseTimeoutError extends BaseError {
}
export declare class ParallelRequestingError extends BaseError {
}
export declare class MqttRequest implements IfMqttRequest {
    client: Mqtt.Client | null;
    connectOptions: Mqtt.IClientOptions;
    requestParams: {
        topic?: string;
        responseTopicSuffix?: string;
        appendUuid?: boolean;
        payload?: string | Buffer;
        qos?: 0 | 1 | 2;
    };
    private isRequesting;
    constructor(connectOptions: Mqtt.IClientOptions);
    private setTimeout;
    do(topic: string, appendUuid: boolean, responseTopicSuffix: string, payload: string | Buffer, qos: 0 | 1 | 2, requestTimeoutMilliseconds: number): Promise<Buffer>;
}
export {};
