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

	private async onMessage(message: string): Promise<any> {
		let request: WebSocketRequest = WebSocketRequest.parse(message);

		if (!request) {
			return this.send(
				WebSocketResponse.error('Error Message format!')
					.setType(WebSocketResponseType.Server)
					.toJSON()
			);
		}

		let method: Function = getMethod(request.getTarget(), request.getMessage());

		if (!method) {
			return this.send(
				WebSocketResponse.error('Method not found! ' + request.getTarget() + '#' + request.getMessage())
					.setCallback(request.getCallback())
					.setType(WebSocketResponseType.Client)
					.toJSON()
			);
		}

		let callArgs: Array<any> = request.getArgs();
		callArgs.unshift(this);
		let ret: WebSocketResponse = await method.apply(null, callArgs);

		this.send(ret.setCallback(request.getCallback()).setType(WebSocketResponseType.Client).toJSON());
	}

	private onClose(): void {
		WebSocketServer.unregister(this);
	}

	public send(json: any): void {
		this.ws.send(JSON.stringify(json));
	}
}