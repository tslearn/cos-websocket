import * as UWS from 'uws';
import {WebSocketContext} from './WebSocketContext';

export class WebSocketServer {
	private static seed: number = 1;
	private port: number;
	private wss: UWS.Server;

	private static clientHash: {[id: number]: WebSocketContext} = {};

	public static register(ws: UWS): WebSocketContext {
		let wsHandler: WebSocketContext = new WebSocketContext(ws, WebSocketServer.seed);
		WebSocketServer.clientHash[WebSocketServer.seed] = wsHandler;
		WebSocketServer.seed += 1;
		return wsHandler;
	}

	public static unregister(wsHandler: WebSocketContext): boolean {
		if (WebSocketServer.clientHash.hasOwnProperty(wsHandler.getHandler().toString())) {
			delete WebSocketServer.clientHash[wsHandler.getHandler()];
			return true;
		} else {
			return false;
		}
	}

	constructor(port: number) {
		this.port = port;
	}

	public start(): void {
		if (this.wss) {
			throw new Error('WebSocketServer has been started!');
		}

		this.wss = new UWS.Server({port: this.port});

		this.wss.on('connection', (ws: UWS) => {
			WebSocketServer.register(ws);
		});
	}
}
