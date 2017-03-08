let methodHash: {[id: string]: Function} = {};
let targetHash: {[id: string]: any} = {};

export function WebSocketTarget(path: string): Function {
	return function (target: any): void {
		if (targetHash.hasOwnProperty(path)) {
			throw new Error('WebSocketTarget path is duplicated!');
		}

		target.$$Target$$ = path;
		targetHash[path] = target;
	};
}

export function WebSocketMethod(messageName: string): Function {
	return function (target: any, name: string, descriptor: PropertyDescriptor): void {
		setTimeout(() => {
			if (!target.$$Target$$) {
				throw new Error('WebSocketMethod class not decorated as WebSocketTarget');
			}

			if (!messageName) {
				throw new Error('WebSocketMethod parameter error!');
			}

			if ('on' + messageName !== name) {
				throw new Error('WebSocketMethod parameter must match method name');
			}

			methodHash[target.$$Target$$ + '#' + messageName] = descriptor.value;
		});
	};
}

export function getMethod(target: string, message: string): Function {
	return methodHash[target + '#' + message];
}