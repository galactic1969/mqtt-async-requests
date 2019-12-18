import * as Mqtt from 'mqtt';
import * as uuid from 'uuid';

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
  isRequesting: boolean;
  do(
    topic: string,
    appendUuid: boolean,
    responseTopicSuffix: string,
    payload: string | Buffer,
    qos: 0 | 1 | 2,
    requestTimeoutMilliseconds: number
  ): Promise<Buffer>;
}

class BaseError extends Error {
  constructor(e?: string) {
    super(e);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TimeoutCancelledBeforeExecution extends BaseError {}
export class ResponseTimeoutError extends BaseError {}
export class ParallelRequestingError extends BaseError {}

export class MqttRequest implements IfMqttRequest {
  client: Mqtt.Client | null = null;
  connectOptions: Mqtt.IClientOptions;
  requestParams: {
    topic?: string;
    responseTopicSuffix?: string;
    appendUuid?: boolean;
    payload?: string | Buffer;
    qos?: 0 | 1 | 2;
  } = {};
  isRequesting = false;

  constructor(connectOptions: Mqtt.IClientOptions, certPath?: string, keyPath?: string) {
    if (connectOptions.protocol == 'mqtts') {
      if (certPath === undefined || keyPath === undefined) {
        throw new Error('in mqtts protocol, certPath and keyPath are required');
      }
    }
    this.connectOptions = connectOptions;
  }

  private setTimeout(msec: number): { exec: Function; cancel: Function } {
    let timeoutId: NodeJS.Timeout | null;
    let r: Function;

    const exec = (): Promise<void> =>
      new Promise(resolve => {
        r = resolve;
        timeoutId = setTimeout(async () => {
          timeoutId = null;
          resolve();
        }, msec);
      });

    return {
      exec,
      cancel: (): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
          r();
        } else {
          throw new TimeoutCancelledBeforeExecution();
        }
      }
    };
  }

  async do(
    topic: string,
    appendUuid: boolean,
    responseTopicSuffix: string,
    payload: string | Buffer,
    qos: 0 | 1 | 2,
    requestTimeoutMilliseconds: number
  ): Promise<Buffer> {
    if (this.isRequesting === true)
      throw new ParallelRequestingError('create instance each request or request sequentially');
    this.isRequesting = true;

    this.requestParams.topic = appendUuid === true ? `${topic}/${uuid.v4()}` : topic;
    this.requestParams.appendUuid = appendUuid;
    this.requestParams.responseTopicSuffix =
      responseTopicSuffix[0] === '/' ? responseTopicSuffix.slice(1) : responseTopicSuffix;
    this.requestParams.qos = qos;
    this.requestParams.payload = payload;

    let response: Buffer | null = null;
    const responseTopic = `${this.requestParams.topic!}/${this.requestParams.responseTopicSuffix!}`;
    const timer = this.setTimeout(requestTimeoutMilliseconds);

    this.client = Mqtt.connect(this.connectOptions);

    this.client.on('connect', () => {
      this.client!.subscribe(
        responseTopic,
        {
          qos: this.requestParams.qos!
        },
        err => {
          if (err) new Error('connection failed');
          this.client!.publish(this.requestParams.topic!, this.requestParams.payload!, {
            qos: this.requestParams.qos!
          });
        }
      );
    });

    this.client.on('message', (topic, payload) => {
      if (topic === responseTopic) {
        response = payload;
        timer.cancel();
      }
    });

    await timer.exec();
    this.client.end();
    this.isRequesting = false;

    if (response !== null) {
      return response;
    } else {
      throw new ResponseTimeoutError();
    }
  }
}
