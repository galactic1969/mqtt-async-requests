/// <reference types="node" />
import * as Mqtt from 'mqtt';
interface IfMqttRequest {
    client: Mqtt.Client | null;
    connectOptions: Mqtt.IClientOptions;
    requestParams: {
        topic?: string;
        responseTopicSuffix?: string;
        appendUuid?: boolean;
        payload?: string | Buffer;
        qos?: 0 | 1 | 2;
    };
    isRequesting: boolean;
    do(topic: string, appendUuid: boolean, responseTopicSuffix: string, payload: string | Buffer, qos: 0 | 1 | 2, requestTimeoutMilliseconds: number): Promise<Buffer>;
}
declare class MqttRequest implements IfMqttRequest {
    client: Mqtt.Client | null;
    connectOptions: Mqtt.IClientOptions;
    requestParams: {
        topic?: string;
        responseTopicSuffix?: string;
        appendUuid?: boolean;
        payload?: string | Buffer;
        qos?: 0 | 1 | 2;
    };
    isRequesting: boolean;
    constructor(connectOptions: Mqtt.IClientOptions, certPath?: string, keyPath?: string);
    private setTimeout;
    do(topic: string, appendUuid: boolean, responseTopicSuffix: string, payload: string | Buffer, qos: 0 | 1 | 2, requestTimeoutMilliseconds: number): Promise<Buffer>;
}
export default MqttRequest;
