export const enum WebSocketResponseType {
	Server = 1,
	Client = 2,
}

export class WebSocketResponse {
	private flagSuccess: boolean;
	private type: WebSocketResponseType;
	private callback: number;
	private message: string;
	private value: any;
	private debug: any;

	constructor(flagSuccess: boolean) {
		this.flagSuccess = flagSuccess;
	}

	static success(): WebSocketResponse {
		return new WebSocketResponse(true);
	}

	static error(): WebSocketResponse {
		return new WebSocketResponse(false);
	}

	public isSuccess(): boolean {
		return this.flagSuccess;
	}

	public getType(): WebSocketResponseType {
		return this.type;
	}

	public setType(type: WebSocketResponseType): WebSocketResponse {
		this.type = type;
		return this;
	}

	public getCallback(): number {
		return this.callback;
	}

	public setCallback(callback: number): WebSocketResponse {
		this.callback = callback;
		return this;
	}

	public getMessage(): string {
		return this.message;
	}

	public setMessage(message: string): WebSocketResponse {
		this.message = message;
		return this;
	}

	public getValue(): any {
		return this.value;
	}

	public setValue(value: any): WebSocketResponse {
		this.value = value;
		return this;
	}

	public getDebug(): any {
		return this.debug;
	}

	public setDebug(debug: any): WebSocketResponse {
		this.debug = debug;
		return this;
	}

	public toJSON(): any {
		return {
			s: this.flagSuccess,
			t: this.type,
			c: this.callback,
			m: this.message,
			v: this.value,
			d: this.debug
		};
	}

	public static parse(value: string): WebSocketResponse {
		try {
			let obj: any = JSON.parse(value);

			if (!obj || !obj.t) {
				return null;
			}

			return new WebSocketResponse(obj.s)
				.setType(obj.t)
				.setCallback(obj.c)
				.setMessage(obj.m)
				.setValue(obj.v)
				.setDebug(obj.d);
		} catch (e) {
			return null;
		}
	}
}