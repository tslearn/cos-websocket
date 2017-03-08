export const enum LogLevel {
	Debug,
	Info,
	Warn,
	Error
}

export class WebSocketClientObserver {
	onOpen: () => void;
	onServerMessage: (message: string, value: any) => void;
	onError: () => void;
	onClose: () => void;
	onLog: (level: LogLevel, message: string) => void;
}