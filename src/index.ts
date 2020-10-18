import * as Mqtt from 'mqtt';
import * as uuid from 'uuid';

export interface IfMqttRequest {
  client: Mqtt.Client | null;
  connectOptions: Mqtt.IClientOptions;
  do(
    topic: string,
    appendUuid: boolean,
    responseTopicSuffix: string,
    payload: string | Buffer,
    qos: 0 | 1 | 2,
    requestTimeoutMilliseconds: number
  ): Promise<Buffer>;
  doMany(
    topics: string[],
    appendUuid: boolean,
    responseTopicSuffix: string,
    payloads: (string | Buffer)[],
    qos: 0 | 1 | 2,
    requestTimeoutMilliseconds: number
  ): Promise<Buffer[]>;
}

class BaseError extends Error {
  constructor(e?: string) {
    super(e);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TimeoutCancelledBeforeExecution extends BaseError {}
export class ConnectionError extends BaseError {}
export class ResponseTimeoutError extends BaseError {}
export class ParallelRequestingError extends BaseError {}
export class ParameterError extends BaseError {}

export class MqttRequest implements IfMqttRequest {
  client: Mqtt.Client | null = null;
  connectOptions: Mqtt.IClientOptions;

  private isRequesting = false;

  constructor(connectOptions: Mqtt.IClientOptions) {
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

  async pingConnection(connectionTimeoutMilliseconds: number): Promise<void> {
    this.client = Mqtt.connect(
      Object.assign(this.connectOptions, {
        connectTimeout: connectionTimeoutMilliseconds
      })
    );

    this.client.on('connect', () => {
      this.client?.end();
    });

    const timer = this.setTimeout(connectionTimeoutMilliseconds);
    await timer.exec();

    if (!this.client.disconnected) this.client.end();
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

    const requestTopic = appendUuid === true ? `${topic}/${uuid.v4()}` : topic;
    const resSuffix = responseTopicSuffix[0] === '/' ? responseTopicSuffix.slice(1) : responseTopicSuffix;
    const responseTopic = `${requestTopic}/${resSuffix}`;

    let response: Buffer = new Buffer('');
    const timer = this.setTimeout(requestTimeoutMilliseconds);

    this.client = Mqtt.connect(this.connectOptions);

    this.client.on('connect', () => {
      this.client!.subscribe(
        responseTopic,
        {
          qos: qos
        },
        err => {
          if (err) new ConnectionError();
          this.client!.publish(requestTopic, payload, {
            qos: qos
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

    if (response.length > 0) {
      return response;
    } else {
      throw new ResponseTimeoutError();
    }
  }

  async doMany(
    topics: string[],
    appendUuid: boolean,
    responseTopicSuffix: string,
    payloads: (string | Buffer)[],
    qos: 0 | 1 | 2,
    requestTimeoutMilliseconds: number
  ): Promise<Buffer[]> {
    if (this.isRequesting === true)
      throw new ParallelRequestingError('create instance each request or request sequentially');
    if (topics.length !== payloads.length) throw new ParameterError('array length unmatch between topics and payloads');

    this.isRequesting = true;

    const requestTopics: string[] = topics.map(topic => {
      return appendUuid === true ? `${topic}/${uuid.v4()}` : topic;
    });
    const resSuffix = responseTopicSuffix[0] === '/' ? responseTopicSuffix.slice(1) : responseTopicSuffix;
    const responseTopics: string[] = requestTopics.map(requestTopic => {
      return `${requestTopic}/${resSuffix}`;
    });

    const responsesMap: { [index: string]: Buffer } = {};
    const responses: Buffer[] = [];
    const requestCounts = topics.length;

    const timer = this.setTimeout(requestTimeoutMilliseconds);

    this.client = Mqtt.connect(this.connectOptions);

    this.client.on('connect', () => {
      this.client!.subscribe(
        '#',
        {
          qos: qos
        },
        err => {
          if (err) new ConnectionError();
          requestTopics.forEach((requestTopic, index) => {
            this.client!.publish(requestTopic, payloads[index], {
              qos: qos
            });
          });
        }
      );
    });

    this.client.on('message', (topic, payload) => {
      const foundIndex = responseTopics.findIndex(item => item === topic);
      if (foundIndex !== -1) {
        responsesMap[foundIndex.toString()] = payload;
        if (Object.keys(responsesMap).length === requestCounts) {
          Object.keys(responsesMap).forEach(indexString => {
            responses[parseInt(indexString)] = responsesMap[indexString];
          });
          timer.cancel();
        }
      }
    });

    await timer.exec();
    this.client.end();
    this.isRequesting = false;

    if (responses.length > 0) {
      return responses;
    } else {
      throw new ResponseTimeoutError();
    }
  }
}
