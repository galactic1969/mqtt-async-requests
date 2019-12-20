/// <reference types="node" />
import * as Mqtt from 'mqtt';
export interface IfMqttRequest {
    client: Mqtt.Client | null;
    connectOptions: Mqtt.IClientOptions;
    do(topic: string, appendUuid: boolean, responseTopicSuffix: string, payload: string | Buffer, qos: 0 | 1 | 2, requestTimeoutMilliseconds: number): Promise<Buffer>;
    doMany(topics: string[], appendUuid: boolean, responseTopicSuffix: string, payloads: (string | Buffer)[], qos: 0 | 1 | 2, requestTimeoutMilliseconds: number): Promise<Buffer[]>;
}
declare class BaseError extends Error {
    constructor(e?: string);
}
export declare class TimeoutCancelledBeforeExecution extends BaseError {
}
export declare class ConnectionError extends BaseError {
}
export declare class ResponseTimeoutError extends BaseError {
}
export declare class ParallelRequestingError extends BaseError {
}
export declare class ParameterError extends BaseError {
}
export declare class MqttRequest implements IfMqttRequest {
    client: Mqtt.Client | null;
    connectOptions: Mqtt.IClientOptions;
    private isRequesting;
    constructor(connectOptions: Mqtt.IClientOptions);
    private setTimeout;
    do(topic: string, appendUuid: boolean, responseTopicSuffix: string, payload: string | Buffer, qos: 0 | 1 | 2, requestTimeoutMilliseconds: number): Promise<Buffer>;
    doMany(topics: string[], appendUuid: boolean, responseTopicSuffix: string, payloads: (string | Buffer)[], qos: 0 | 1 | 2, requestTimeoutMilliseconds: number): Promise<Buffer[]>;
}
export {};
