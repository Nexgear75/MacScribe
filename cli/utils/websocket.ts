import WebSocket from 'ws';
import { EventEmitter } from 'events';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'error';

export interface Task {
	id: number;
	name: string;
	status: TaskStatus;
	progress: number;
	download_percent?: number;
	download_speed?: number | null;
}

export interface WebSocketMessage {
	type: 'connected' | 'init' | 'progress' | 'status' | 'error' | 'complete' | 'generation_start' | 'generation_content' | 'generation_token' | 'download_complete';
	task_id?: string;
	tasks?: Task[];
	progress?: number;
	download_percent?: number;
	download_speed?: number | null;
	status?: TaskStatus;
	message?: string;
	output_path?: string;
	prompt?: string;
	content?: string;
	token?: string;
	video_path?: string;
	title?: string;
}

export class WebSocketClient extends EventEmitter {
	private ws: WebSocket | null = null;
	private readonly url: string;


	constructor(url: string = 'ws://localhost:8000/ws/process') {
		super();
		this.url = url;
	}

	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.ws = new WebSocket(this.url);

				this.ws.on('open', () => {
					this.emit('connected');
					resolve();
				});

				this.ws.on('message', (data: Buffer) => {
					try {
						const message: WebSocketMessage = JSON.parse(data.toString());
						this.emit('message', message);

						switch (message.type) {
							case 'connected':
								this.emit('taskCreated', message.task_id);
								break;
							case 'init':
								this.emit('tasksInitialized', message.tasks);
								break;
							case 'progress':
								this.emit('progress', message.task_id, message.progress, message.download_percent, message.download_speed);
								break;
							case 'status':
								this.emit('status', message.task_id, message.status);
								break;
							case 'error':
								this.emit('error', message.message);
								break;
						case 'complete':
							this.emit('complete', message.output_path);
							break;
						case 'generation_start':
							this.emit('generation_start', { prompt: message.prompt });
							break;
						case 'generation_token':
							this.emit('generation_token', { token: message.token, content: message.content });
							break;
						case 'generation_content':
							this.emit('generation_content', { content: message.content });
							break;
						case 'download_complete':
							this.emit('download_complete', { video_path: message.video_path, title: message.title });
							break;
					}
					} catch (error) {
						this.emit('error', 'Failed to parse message');
					}
				});

				this.ws.on('error', (error) => {
					this.emit('error', error.message);
					reject(error);
				});

				this.ws.on('close', () => {
					this.emit('disconnected');
				});
			} catch (error) {
				reject(error);
			}
		});
	}

	send(data: object): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(data));
		} else {
			throw new Error('WebSocket is not connected');
		}
	}

	disconnect(): void {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}

	isConnected(): boolean {
		return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
	}
}

export function createWebSocketClient(): WebSocketClient {
	return new WebSocketClient();
}
