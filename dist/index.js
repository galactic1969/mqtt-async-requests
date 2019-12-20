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
class ConnectionError extends BaseError {
}
exports.ConnectionError = ConnectionError;
class ResponseTimeoutError extends BaseError {
}
exports.ResponseTimeoutError = ResponseTimeoutError;
class ParallelRequestingError extends BaseError {
}
exports.ParallelRequestingError = ParallelRequestingError;
class ParameterError extends BaseError {
}
exports.ParameterError = ParameterError;
class MqttRequest {
    constructor(connectOptions) {
        this.client = null;
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
        const requestTopic = appendUuid === true ? `${topic}/${uuid.v4()}` : topic;
        const resSuffix = responseTopicSuffix[0] === '/' ? responseTopicSuffix.slice(1) : responseTopicSuffix;
        const responseTopic = `${requestTopic}/${resSuffix}`;
        let response = new Buffer('');
        const timer = this.setTimeout(requestTimeoutMilliseconds);
        this.client = Mqtt.connect(this.connectOptions);
        this.client.on('connect', () => {
            this.client.subscribe(responseTopic, {
                qos: qos
            }, err => {
                if (err)
                    new ConnectionError();
                this.client.publish(requestTopic, payload, {
                    qos: qos
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
    async doMany(topics, appendUuid, responseTopicSuffix, payloads, qos, requestTimeoutMilliseconds) {
        if (this.isRequesting === true)
            throw new ParallelRequestingError('create instance each request or request sequentially');
        if (topics.length !== payloads.length)
            throw new ParameterError('array length unmatch between topics and payloads');
        this.isRequesting = true;
        const requestTopics = topics.map(topic => {
            return appendUuid === true ? `${topic}/${uuid.v4()}` : topic;
        });
        const resSuffix = responseTopicSuffix[0] === '/' ? responseTopicSuffix.slice(1) : responseTopicSuffix;
        const responseTopics = requestTopics.map(requestTopic => {
            return `${requestTopic}/${resSuffix}`;
        });
        const responsesMap = {};
        const responses = [];
        const requestCounts = topics.length;
        const timer = this.setTimeout(requestTimeoutMilliseconds);
        this.client = Mqtt.connect(this.connectOptions);
        this.client.on('connect', () => {
            this.client.subscribe('#', {
                qos: qos
            }, err => {
                if (err)
                    new ConnectionError();
                requestTopics.forEach((requestTopic, index) => {
                    this.client.publish(requestTopic, payloads[index], {
                        qos: qos
                    });
                });
            });
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
        }
        else {
            throw new ResponseTimeoutError();
        }
    }
}
exports.MqttRequest = MqttRequest;
//# sourceMappingURL=index.js.map