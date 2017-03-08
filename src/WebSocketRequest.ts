export class WebSocketRequest {
	private callback: number;
	private target: string;
	private message: string;
	private args: Array<any>;

	public constructor(callback: number,
	                    target: string,
	                    message: string,
	                    args: Array<any>) {
		this.callback = callback;
		this.target = target;
		this.message = message;
		this.args = args;
	}

	public static parse(value: string): WebSocketRequest {
		try {
			let obj: any = JSON.parse(value);

			if (!obj || !obj.c) {
				return null;
			}

			return new WebSocketRequest(obj.c, obj.t, obj.m, obj.a);
		} catch (e) {
			return null;
		}
	}

	public toJSON(): any {
		return {
			c: this.callback,
			t: this.target,
			m: this.message,
			a: this.args
		};
	}

	public getCallback(): number {
		return this.callback;
	}

	public getTarget(): string {
		return this.target;
	}

	public getMessage(): string {
		return this.message;
	}

	public getArgs(): Array<any> {
		return this.args;
	}
}
