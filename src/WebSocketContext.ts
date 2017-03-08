import * as UWS from 'uws';
import {getMethod} from './WebSocketDecorator';
import {WebSocketServer} from './WebSocketServer';
import {WebSocketRequest} from './WebSocketRequest';
import {WebSocketResponse, WebSocketResponseType} from './WebSocketResponse';

export class WebSocketContext {
	private ws: UWS;
	private handler: number;

	constructor(ws: UWS, handler: number) {
		this.ws = ws;
		this.handler = handler;
		this.ws.on('message', this.onMessage.bind(this));
		this.ws.on('close', this.onClose.bind(this));
	}

	public getHandler(): number {
		return this.handler;
	}

	private onMessage(message: string): void {
		let request: WebSocketRequest = WebSocketRequest.parse(message);

		if (!request) {
			return this.send(
				WebSocketResponse.error()
					.setType(WebSocketResponseType.Server)
					.setMessage('WebSocketFormatError')
					.setDebug('Error Message format!').toJSON()
			);
		}

		let method: Function = getMethod(request.getTarget(), request.getMessage());

		if (!method) {
			return this.send(
				WebSocketResponse.error()
					.setCallback(request.getCallback())
					.setType(WebSocketResponseType.Client)
					.setDebug('Method not found! Target: ' + request.getTarget() + ' Message: ' + request.getMessage())
					.toJSON()
			);
		}

		let ret: WebSocketResponse = (method(this, request.getArgs()) as WebSocketResponse)
			.setCallback(request.getCallback())
			.setType(WebSocketResponseType.Client);

		this.send(ret.toJSON());
	}

	private onClose(): void {
		WebSocketServer.unregister(this);
	}

	public send(json: any): void {
		this.ws.send(JSON.stringify(json));
	}
}