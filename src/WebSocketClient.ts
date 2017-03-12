import * as BlueBird from 'bluebird';
import {WebSocketResponse, WebSocketResponseType} from './WebSocketResponse';
import {WebSocketRequest} from './WebSocketRequest';
import {WebSocketMessage} from './WebSocketMessage';
import {WebSocketClientObserver, WebSocketLogLevel} from './WebSocketClientObserver';

let getSeed: () => number = ((): any => {
	let seed: number = 0;
	return (): number => {
		seed++;
		return seed;
	};
})();


const enum WebSocketClientInvokeType {
	Open = 1,
	ServerMessage = 2,
	Error = 3,
	Close = 4,
	LogDebug = 5,
	LogInfo = 6,
	LogWarn = 7,
	LogError = 8,
}

class Deferred<T> {
	promise: BlueBird<T>;
	resolve: (value?: T | BlueBird<T>) => void;
	reject: (error?: WebSocketMessage) => void;

	constructor() {
		this.promise = new BlueBird<T>((function (resolve: any, reject: any): void {
			this.resolve = resolve;
			this.reject = reject;
		}).bind(this));
	}
}

class SendMessage {
	private time: number;
	private deferred: Deferred<WebSocketMessage>;
	private callback: number;
	private target: string;
	private message: string;
	private args: Array<any>;

	public getTime(): number {
		return this.time;
	}

	public getDeferred(): Deferred<WebSocketMessage> {
		return this.deferred;
	}

	public getTarget(): string {
		return this.target;
	}

	public getMessage(): string {
		return this.message;
	}

	public getCallback(): number {
		return this.callback;
	}

	constructor(target: string, message: string, args: Array<any>) {
		this.time = new Date().getTime();
		this.deferred = new Deferred<WebSocketMessage>();
		this.callback = getSeed();
		this.target = target;
		this.message = message;
		this.args = args;
	}

	toWebSocketRequest(): WebSocketRequest {
		return new WebSocketRequest(this.callback, this.target, this.message, this.args);
	}
}

export class WebSocketClient {
	private sockUrl: string;
	private timeout: number;
	private flagDebug: boolean;
	private nextConnectInterval: number = 0;
	private lastConnectTimeMS: number = 0;
	private flagStart: boolean = false;
	private evalPool: {[key: string]: SendMessage} = {};
	private timerHandler: any = null;
	private webSocket: WebSocket = null;
	private listeners: {[key: string]: WebSocketClientObserver} = {};

	constructor(sockUrl: string, timeout: number = 16000, flagDebug: boolean = false) {
		this.sockUrl = sockUrl;
		this.timeout = timeout;
		this.flagDebug = flagDebug;
	}

	public addListener(observe: WebSocketClientObserver): string {
		let key: string = getSeed() + '';
		this.listeners[key] = observe;

		if (this.isConnected()) {
			observe.onOpen && observe.onOpen();
		}

		return key;
	}

	public removeListener(handler: string): boolean {
		if (this.listeners.hasOwnProperty(handler)) {
			delete this.listeners[handler + ''];
			return true;
		} else {
			return false;
		}
	}

	private invokeListeners(type: WebSocketClientInvokeType, message: string, value: any): void {
		for (let key in this.listeners) {
			if (this.listeners.hasOwnProperty(key)) {
				let item: WebSocketClientObserver = this.listeners[key];
				switch (type) {
					case WebSocketClientInvokeType.Open:
						item.onOpen && item.onOpen();
						break;
					case WebSocketClientInvokeType.ServerMessage:
						item.onServerMessage && item.onServerMessage(message, value);
						break;
					case WebSocketClientInvokeType.Error:
						item.onError && item.onError();
						break;
					case WebSocketClientInvokeType.Close:
						item.onClose && item.onClose();
						break;
					case WebSocketClientInvokeType.LogDebug:
						item.onLog && item.onLog(WebSocketLogLevel.Debug, message);
						break;
					case WebSocketClientInvokeType.LogInfo:
						item.onLog && item.onLog(WebSocketLogLevel.Info, message);
						break;
					case WebSocketClientInvokeType.LogWarn:
						item.onLog && item.onLog(WebSocketLogLevel.Warn, message);
						break;
					case WebSocketClientInvokeType.LogError:
						item.onLog && item.onLog(WebSocketLogLevel.Error, message);
						break;
					default:
						break;
				}
			}
		}
	}

	private onTimer(): void {
		if (this.flagStart) {
			let now: number = new Date().getTime();
			let timeoutKeys: Array<string> = [];

			for (let key in this.evalPool) {
				if (this.evalPool.hasOwnProperty(key)) {
					if (now - this.evalPool[key].getTime() > this.timeout) {
						timeoutKeys.push(key);
					}
				}
			}

			timeoutKeys.forEach((key: string): void => {
				let deferred: Deferred<WebSocketMessage> = this.evalPool[key].getDeferred();
				delete this.evalPool[key];
				deferred.reject({
					message: 'Timeout',
					value: null
				});
			});

			this.connect();
		}
	}

	public start(): WebSocketClient {
		if (this.flagStart) {
			throw new Error('WebSocketClient has benn started!');
		}

		this.nextConnectInterval = 0;
		this.lastConnectTimeMS = 0;
		this.evalPool = {};
		this.timerHandler = setInterval((): void => this.onTimer(), 1000);
		this.flagStart = true;
		this.connect();
		return this;
	}

	public stop(): boolean {
		if (!this.flagStart) {
			throw new Error('WebSocketClient has not benn started!');
		}

		this.flagStart = false;
		this.timerHandler && clearInterval(this.timerHandler);
		this.disconnect();
		this.evalPool = {};
		this.nextConnectInterval = 0;
		this.lastConnectTimeMS = 0;
		return true;
	}

	public isConnected(): boolean {
		return !!this.webSocket && this.webSocket.readyState === WebSocket.OPEN;
	}

	public isClosed(): boolean {
		return !this.webSocket || this.webSocket.readyState === WebSocket.CLOSED;
	}

	private onOpen(): void {
		this.nextConnectInterval = 0;
		this.lastConnectTimeMS = 0;

		this.invokeListeners(WebSocketClientInvokeType.Open, 'WebSocketOpen', null);
	}

	private onClose(): void {
		this.webSocket = null;

		for (let key in this.evalPool) {
			if (this.evalPool.hasOwnProperty(key)) {
				this.evalPool[key].getDeferred().reject({message: 'WebSocketClose', value: null});
			}
		}

		this.evalPool = {};

		this.invokeListeners(WebSocketClientInvokeType.Close, 'WebSocketClose', null);
	}

	private onError(): void {
		this.invokeListeners(WebSocketClientInvokeType.Error, 'WebSocketError', null);
	}

	private onMessage(evt: {data: string}): void {
		if (!evt || typeof evt.data !== 'string') {
			return;
		}

		let cbData: string = evt.data;

		// parse data
		let response: WebSocketResponse = WebSocketResponse.parse(cbData);

		if (!response) {
			this.invokeListeners(WebSocketClientInvokeType.LogError, 'WebSocketClient date parse error! received: ' + cbData, null);
			return;
		}

		if (this.flagDebug) {
			this.invokeListeners(WebSocketClientInvokeType.LogDebug, 'WebSocketClient received: ' + cbData, null);
		}

		switch (response.getType()) {
			case WebSocketResponseType.Client:
				let sendMessage: SendMessage = this.evalPool[response.getCallback()];

				if (!sendMessage || !sendMessage.getDeferred()) {
					return;
				}

				if (response.isSuccess()) {
					sendMessage.getDeferred().resolve({
						message: response.getMessage(),
						value: response.getValue()
					});
				} else {
					sendMessage.getDeferred().reject({
						message: response.getMessage(),
						value: 'hi'
					});
				}

				delete this.evalPool[response.getCallback()];
				break;
			case WebSocketResponseType.Server:
				this.invokeListeners(WebSocketClientInvokeType.ServerMessage, response.getMessage(), response.getValue());
				break;
			default:
				break;
		}
	}

	private connect(): void {
		if (this.isClosed()) {
			let needInterval: number = Math.min(8000, this.nextConnectInterval + 1500);

			if (new Date().getTime() - this.lastConnectTimeMS > needInterval) {
				if (this.lastConnectTimeMS > 0) {
					this.nextConnectInterval = new Date().getTime() - this.lastConnectTimeMS;
					this.invokeListeners(WebSocketClientInvokeType.LogWarn, 'Set next connect interval ' + this.nextConnectInterval, null);
				}

				this.lastConnectTimeMS = new Date().getTime();

				this.webSocket = new WebSocket(this.sockUrl);
				this.webSocket.onopen = (ev: any): void => {
					this.onOpen();
				};
				this.webSocket.onmessage = (ev: {data: string}): void => {
					this.onMessage(ev);
				};
				this.webSocket.onerror = (ev: any): void => {
					this.onError();
				};
				this.webSocket.onclose = (ev: any): void => {
					this.onClose();
				};
			}
		}
	}

	connectNow(): void {
		this.nextConnectInterval = 0;
		this.lastConnectTimeMS = 0;
		this.connect();
	}

	disconnect(): boolean {
		if (!this.webSocket) {
			return false;
		}

		switch (this.webSocket.readyState) {
			case WebSocket.OPEN:
			case WebSocket.CONNECTING:
				this.webSocket.close();
				return true;
			default:
				return false;
		}
	}

	send(target: string, message: string, ...args: Array<any>): BlueBird<WebSocketMessage> {
		let msg: SendMessage = new SendMessage(target, message, args);

		if (this.isConnected()) {
			if (this.flagDebug) {
				let argString: string = JSON.stringify(args);
				this.invokeListeners(
					WebSocketClientInvokeType.LogDebug,
					'WebSocketClient send: ' + msg.getTarget() + '.' + msg.getMessage() + '(' + argString.substr(1, argString.length - 2) + ')',
					null
				);
			}

			msg.toWebSocketRequest();

			this.evalPool[msg.getCallback() + ''] = msg;
			this.webSocket && this.webSocket.send(JSON.stringify(msg.toWebSocketRequest().toJSON()));
		} else {
			setTimeout((): void => {
				msg.getDeferred().reject({message: 'WebSocketClose', value: null});
			}, 10);
		}

		return msg.getDeferred().promise;
	}
}

