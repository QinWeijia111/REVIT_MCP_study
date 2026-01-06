/**
 * Revit Socket 客户端
 * 负责与 Revit Plugin 的 WebSocket 通讯
 */

import WebSocket from 'ws';

export interface RevitCommand {
    commandName: string;
    parameters: Record<string, any>;
    requestId?: string;
}

export interface RevitResponse {
    success: boolean;
    data?: any;
    error?: string;
    requestId?: string;
}

export class RevitSocketClient {
    private ws: WebSocket | null = null;
    private host: string = 'localhost';
    private port: number = 8999;
    private reconnectInterval: number = 5000; // 5 秒
    private responseHandlers: Map<string, (response: RevitResponse) => void> = new Map();

    constructor(host: string = 'localhost', port: number = 8999) {  
        this.host = host;
        this.port = port;
    }

    /**
     * 连接到 Revit Plugin
     */
    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const wsUrl = `ws://${this.host}:${this.port}`;
            console.error(`[Socket] 连接至 Revit: ${wsUrl}`);

            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                console.error('[Socket] 已连接至 Revit Plugin');
                resolve();
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const rawResponse = JSON.parse(data.toString());
                    // Map PascalCase from C# to camelCase for internal use
                    const response: RevitResponse = {
                        success: rawResponse.Success,
                        data: rawResponse.Data,
                        error: rawResponse.Error,
                        requestId: rawResponse.RequestId,
                    };
                    console.error('[Socket] 收到回应:', response);

                    // 处理回应
                    if (response.requestId) {
                        const handler = this.responseHandlers.get(response.requestId);
                        if (handler) {
                            handler(response);
                            this.responseHandlers.delete(response.requestId);
                        }
                    }
                } catch (error) {
                    console.error('[Socket] 解析消息失败:', error);
                }
            });

            this.ws.on('error', (error) => {
                console.error('[Socket] WebSocket 错误:', error);
                reject(error);
            });

            this.ws.on('close', () => {
                console.error('[Socket] 连接已关闭');
                this.ws = null;

                // 自动重连
                setTimeout(() => {
                    console.error('[Socket] 尝试重新连接...');
                    this.connect().catch(err => {
                        console.error('[Socket] 重新连接失败:', err);
                    });
                }, this.reconnectInterval);
            });

            // 连接超时
            setTimeout(() => {
                if (this.ws?.readyState !== WebSocket.OPEN) {
                    reject(new Error('连接超时：请确认 Revit Plugin 是否已启动并开启 MCP 服务'));
                }
            }, 10000);
        });
    }

    /**
     * 发送命令到 Revit
     */
    async sendCommand(commandName: string, parameters: Record<string, any> = {}): Promise<RevitResponse> {
        if (!this.isConnected()) {
            throw new Error('未连接至 Revit Plugin');
        }

        const requestId = this.generateRequestId();
        const command = {
            CommandName: commandName,
            Parameters: parameters,
            RequestId: requestId,
        };

        console.error(`[Socket] 发送命令: ${commandName}`, parameters);

        return new Promise((resolve, reject) => {
            // 注册回应处理器
            this.responseHandlers.set(requestId, (response: RevitResponse) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || '命令执行失败'));
                }
            });

            // 发送命令
            this.ws?.send(JSON.stringify(command));

            // 设置超时
            setTimeout(() => {
                if (this.responseHandlers.has(requestId)) {
                    this.responseHandlers.delete(requestId);
                    reject(new Error('命令执行超时'));
                }
            }, 30000); // 30 秒逾時
        });
    }

    /**
     * 检查连接状态
     */
    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    /**
     * 关闭连接
     */
    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * 生成唯一请求 ID
     */
    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
