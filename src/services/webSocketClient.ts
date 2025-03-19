import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { CursorPosition, SelectionRange, CollaborationUser } from './collaborationService';

export type UserStatus = 'active' | 'away' | 'online' | 'offline';
export type MessageHandler = (message: any) => void;
export type ConnectionStatusChangeHandler = (connected: boolean) => void;

interface Message {
  type: string;
  payload: any;
  timestamp?: number;
  messageId?: string;
}

export class WebSocketClient {
  private socket: Socket | null = null;
  private connected: boolean = false;
  private sessionId: string | null = null;
  private userId: string = '';
  private userName: string = '';
  private messageHandlers: Array<(message: Message) => void> = [];
  private connectionStatusChangeHandlers: Array<ConnectionStatusChangeHandler> = [];
  private serverUrl: string = process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:3001';
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private reconnecting: boolean = false;
  private reconnectTimer: number | null = null;

  constructor() {
    console.log('初始化WebSocket客户端, 服务器URL:', this.serverUrl);
  }

  // 检查连接状态
  public isConnected(): boolean {
    return this.connected && !!this.socket?.connected;
  }

  // 连接到WebSocket服务器，添加重试机制
  public async connect(sessionId: string, userId: string, userName: string): Promise<boolean> {
    return this.connectWithRetry(sessionId, userId, userName, this.maxRetries);
  }

  // 带重试的连接方法
  private async connectWithRetry(
    sessionId: string, 
    userId: string, 
    userName: string, 
    retriesLeft: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        if (this.isConnected() && this.sessionId === sessionId) {
          console.log('已经连接到会话:', sessionId);
          resolve(true);
          return;
        }

        // 如果已连接但会话不同，先断开
        if (this.isConnected()) {
          this.disconnect();
        }

        console.log(`连接到会话: ${sessionId}, 用户ID: ${userId}, 用户名: ${userName}`);

        // 创建Socket.IO连接
        this.socket = io(this.serverUrl);

        // 处理连接事件
        this.socket.on('connect', () => {
          console.log('Socket.IO连接成功');
          
          // 加入会话
          this.socket!.emit('join', {
            sessionId,
            userId,
            userName
          });
        });

        // 处理连接确认
        this.socket.on('connection_ack', (data: {success: boolean, sessionId: string, userId: string, error?: string}) => {
          if (data.success) {
            console.log('服务器确认连接成功');
            this.connected = true;
            this.sessionId = sessionId;
            this.userId = userId;
            this.userName = userName;
            this.retryCount = 0;
            this.reconnecting = false;
            
            // 通知连接状态变化
            this.notifyConnectionStatusChange(true);
            
            resolve(true);
          } else {
            console.error('服务器拒绝连接:', data.error);
            this.connected = false;
            this.handleConnectionFailure(resolve, sessionId, userId, userName, retriesLeft);
          }
        });

        // 处理消息
        this.socket.on('message', (message: Message) => {
          this.receiveMessage(message);
        });

        // 处理错误
        this.socket.on('error', (error: any) => {
          console.error('Socket.IO错误:', error);
          this.notifyConnectionStatusChange(false);
          this.handleConnectionFailure(resolve, sessionId, userId, userName, retriesLeft);
        });

        // 处理断开连接
        this.socket.on('disconnect', () => {
          console.log('Socket.IO断开连接');
          this.connected = false;
          this.notifyConnectionStatusChange(false);
          
          if (this.sessionId && !this.reconnecting) {
            this.reconnecting = true;
            console.log('尝试自动重新连接...');
            this.reconnectWithDelay(sessionId, userId, userName);
          }
        });

        const timeout = window.setTimeout(() => {
          if (!this.connected) {
            console.error('连接超时');
            clearTimeout(timeout);
            this.handleConnectionFailure(resolve, sessionId, userId, userName, retriesLeft);
          }
        }, 5000);
      } catch (error) {
        console.error('连接失败:', error);
        this.connected = false;
        this.notifyConnectionStatusChange(false);
        this.handleConnectionFailure(resolve, sessionId, userId, userName, retriesLeft);
      }
    });
  }

  // 处理连接失败，实现重试逻辑
  private handleConnectionFailure(
    resolve: (value: boolean) => void,
    sessionId: string,
    userId: string,
    userName: string,
    retriesLeft: number
  ): void {
    if (retriesLeft > 0) {
      console.log(`连接失败，还有${retriesLeft}次重试机会，1秒后重试...`);
      this.retryCount++;
      
      window.setTimeout(() => {
        this.connectWithRetry(sessionId, userId, userName, retriesLeft - 1)
          .then(resolve)
          .catch(() => resolve(false));
      }, 1000);
    } else {
      console.error('连接失败，已达到最大重试次数');
      resolve(false);
    }
  }
  
  // 断开连接后延迟重连
  private reconnectWithDelay(sessionId: string, userId: string, userName: string): void {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = window.setTimeout(() => {
      console.log('执行重新连接...');
      this.connect(sessionId, userId, userName)
        .then(success => {
          if (success) {
            console.log('重新连接成功');
          } else {
            console.error('重新连接失败');
          }
          this.reconnecting = false;
        })
        .catch(() => {
          console.error('重新连接过程中出错');
          this.reconnecting = false;
        });
    }, 2000);
  }

  // 断开连接
  public disconnect(): void {
    if (!this.connected || !this.socket) return;

    try {
      console.log(`用户 ${this.userName} (${this.userId}) 断开连接`);

      this.reconnecting = false;
      
      if (this.reconnectTimer) {
        window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.sessionId && this.userId) {
        this.sendMessage({
          type: 'leave',
          payload: {
            userId: this.userId
          }
        });
      }

      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.sessionId = null;
      this.userId = '';
      this.userName = '';

      this.notifyConnectionStatusChange(false);
    } catch (error) {
      console.error('断开连接错误:', error);
    }
  }

  // 发送消息
  private sendMessage(message: Message): void {
    if (!this.connected || !this.socket) return;

    try {
      const enrichedMessage = {
        ...message,
        timestamp: Date.now(),
        messageId: uuidv4()
      };

      this.socket.emit('message', enrichedMessage);
    } catch (error) {
      console.error('发送消息错误:', error);
    }
  }

  // 接收消息
  private receiveMessage(message: Message): void {
    console.log(`收到消息: ${message.type}`);

    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('消息处理错误:', error);
      }
    });
  }

  // 注册消息处理程序
  public onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  // 添加连接状态变化处理器
  public onConnectionStatusChange(handler: ConnectionStatusChangeHandler): void {
    this.connectionStatusChangeHandlers.push(handler);
  }

  // 移除连接状态变化处理器
  public offConnectionStatusChange(handler: ConnectionStatusChangeHandler): void {
    this.connectionStatusChangeHandlers = this.connectionStatusChangeHandlers.filter(h => h !== handler);
  }

  // 通知连接状态变化
  private notifyConnectionStatusChange(connected: boolean): void {
    this.connectionStatusChangeHandlers.forEach(handler => {
      try {
        handler(connected);
      } catch (error) {
        console.error('连接状态变化处理器执行错误', error);
      }
    });
  }

  // 发送操作
  public sendOperation(operation: any): void {
    if (!this.connected || !this.userId) return;

    this.sendMessage({
      type: 'operation',
      payload: {
        operation: {
          ...operation,
          timestamp: Date.now()
        }
      }
    });
  }

  // 发送光标位置更新
  public sendCursorPosition(position: number, line: number, column: number): void {
    if (!this.connected || !this.userId) return;

    this.sendMessage({
      type: 'cursor',
      payload: {
        userId: this.userId,
        position,
        line,
        column
      }
    });
  }

  // 发送选择区域信息
  public sendSelectionRange(range: { 
    start: { position: number, line: number, column: number }, 
    end: { position: number, line: number, column: number } 
  }): void {
    if (!this.connected || !this.userId) return;

    this.sendMessage({
      type: 'selection',
      payload: {
        userId: this.userId,
        start: range.start,
        end: range.end
      }
    });
  }

  // 发送用户状态变化
  public sendUserStatus(userId: string, status: UserStatus): void {
    if (!this.connected) return;

    this.sendMessage({
      type: 'status',
      payload: {
        userId,
        status
      }
    });
  }

  // 发送用户活动通知
  public sendUserActivity(userId: string, activityType: string): void {
    if (!this.connected) return;

    this.sendMessage({
      type: 'activity',
      payload: {
        userId,
        type: activityType,
        timestamp: Date.now()
      }
    });
  }

  // 发送心跳
  public sendHeartbeat(userId: string): void {
    if (!this.connected) return;

    this.sendMessage({
      type: 'heartbeat',
      payload: {
        userId,
        timestamp: Date.now()
      }
    });
  }

  // 请求同步用户列表
  public requestSyncUsers(): void {
    if (!this.connected) return;

    this.socket!.emit('request_sync');
  }

  // 获取当前会话ID
  public getSessionId(): string | null {
    return this.sessionId;
  }

  // 获取当前用户ID
  public getUserId(): string {
    return this.userId;
  }
}

// 创建单例实例
export const websocketService = new WebSocketClient(); 