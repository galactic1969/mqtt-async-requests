"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Mqtt = __importStar(require("mqtt"));
const uuid = __importStar(require("uuid"));
class BaseError extends Error {
    constructor(e) {
        super(e);
        this.name = new.target.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
class TimeoutCancelledBeforeExecution extends BaseError {
}
exports.TimeoutCancelledBeforeExecution = TimeoutCancelledBeforeExecution;
class ResponseTimeoutError extends BaseError {
}
exports.ResponseTimeoutError = ResponseTimeoutError;
class ParallelRequestingError extends BaseError {
}
exports.ParallelRequestingError = ParallelRequestingError;
class MqttRequest {
    constructor(connectOptions) {
        this.client = null;
        this.requestParams = {};
        this.isRequesting = false;
        this.connectOptions = connectOptions;
    }
    setTimeout(msec) {
        let timeoutId;
        let r;
        const exec = () => new Promise(resolve => {
            r = resolve;
            timeoutId = setTimeout(async () => {
                timeoutId = null;
                resolve();
            }, msec);
        });
        return {
            exec,
            cancel: () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                    r();
                }
                else {
                    throw new TimeoutCancelledBeforeExecution();
                }
            }
        };
    }
    async do(topic, appendUuid, responseTopicSuffix, payload, qos, requestTimeoutMilliseconds) {
        if (this.isRequesting === true)
            throw new ParallelRequestingError('create instance each request or request sequentially');
        this.isRequesting = true;
        this.requestParams.topic = appendUuid === true ? `${topic}/${uuid.v4()}` : topic;
        this.requestParams.appendUuid = appendUuid;
        this.requestParams.responseTopicSuffix =
            responseTopicSuffix[0] === '/' ? responseTopicSuffix.slice(1) : responseTopicSuffix;
        this.requestParams.qos = qos;
        this.requestParams.payload = payload;
        let response = new Buffer('');
        const responseTopic = `${this.requestParams.topic}/${this.requestParams.responseTopicSuffix}`;
        const timer = this.setTimeout(requestTimeoutMilliseconds);
        this.client = Mqtt.connect(this.connectOptions);
        this.client.on('connect', () => {
            this.client.subscribe(responseTopic, {
                qos: this.requestParams.qos
            }, err => {
                if (err)
                    new Error('connection failed');
                this.client.publish(this.requestParams.topic, this.requestParams.payload, {
                    qos: this.requestParams.qos
                });
            });
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
        }
        else {
            throw new ResponseTimeoutError();
        }
    }
}
exports.MqttRequest = MqttRequest;
//# sourceMappingURL=index.js.map