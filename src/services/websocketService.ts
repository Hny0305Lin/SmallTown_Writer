import { TextOperation as OperationType } from './collaborationService';
import { v4 as uuidv4 } from 'uuid';
import io, { Socket } from 'socket.io-client';
import { Novel } from '../types/Novel';
import { TextOperation } from '../types/TextOperation';

// 明确定义用户状态类型
export enum UserStatus {
  ONLINE = 'online',
  AWAY = 'away',
  OFFLINE = 'offline'
}

// 完善协作用户类型定义
export interface CollaborationUser {
  id: string;
  name: string;
  color?: string;
  status: UserStatus;
  lastActive?: number;
  cursorPosition?: {
    position: number;
    line: number;
    column: number;
  };
  selection?: {
    start: {
      position: number;
      line: number;
      column: number;
    };
    end: {
      position: number;
      line: number;
      column: number;
    };
  };
}

export type MessageHandler = (message: any) => void;
export type ConnectionHandler = () => void;

// 本地存储键
const STORAGE_PREFIX = 'smalltown_writer_';
const CLIENTS_KEY = (sessionId: string) => `${STORAGE_PREFIX}clients_${sessionId}`;
const CONTENT_KEY = (sessionId: string) => `${STORAGE_PREFIX}content_${sessionId}`;
const USERS_KEY = (sessionId: string) => `${STORAGE_PREFIX}users_${sessionId}`;
const MESSAGE_KEY = (sessionId: string) => `${STORAGE_PREFIX}message_${sessionId}`;
const LAST_MESSAGE_ID_KEY = (sessionId: string) => `${STORAGE_PREFIX}last_message_id_${sessionId}`;

// 简单计数器生成唯一用户名
let userCounter: Record<string, number> = {};

// 定义超时时间常量
const AWAY_TIMEOUT = 30 * 1000; // 30秒无活动变为"离开"
const OFFLINE_TIMEOUT = 5 * 60 * 1000; // 5分钟无活动变为"离线"并移除

// 用户名前缀
const USER_NAME_PREFIX = '用户';
const USER_COUNTER_KEY = (sessionId: string) => `${STORAGE_PREFIX}counter_${sessionId}`;

interface WebSocketMessage {
  type: 'join' | 'leave' | 'operation' | 'cursor' | 'sync' | 'content' | 'connection_ack' | 'users' | 'user_joined' | 'user_left' | 'request_users' | 'request_content' | 'status' | 'heartbeat' | 'activity' | 'selection';
  payload: any;
  timestamp?: number;
  messageId?: string;
}

// 添加一个全局的连接状态，确保即使在组件卸载后仍然保持连接
let globalSessionId: string | null = null;
let globalConnected: boolean = false;
let globalUserId: string | null = null;

// 连接状态变化处理器类型
export type ConnectionStatusChangeHandler = (connected: boolean) => void;

// 定义Message类型
interface Message {
  type: string;
  payload: any;
  sender?: string;
  timestamp?: number;
}

// 定义SocketListeners类型
interface SocketListeners {
  connect: () => void;
  disconnect: () => void;
  message: (message: Message) => void;
  operation: (op: TextOperation) => void;
  userJoined: (user: CollaborationUser) => void;
  userLeft: (userId: string) => void;
  userStatusChange: (user: CollaborationUser) => void;
  contentSync: (content: string) => void;
  titleSync: (title: string) => void;
  error: (error: Error) => void;
}

export class WebSocketClient {
  private connected: boolean = false;
  private sessionId: string | null = null;
  private userId: string = '';
  private userName: string = '';
  private messageHandlers: Array<(message: WebSocketMessage) => void> = [];
  private connectionHandlers: Array<() => void> = [];
  private disconnectionHandlers: Array<() => void> = [];
  private connectionStatusChangeHandlers: Array<ConnectionStatusChangeHandler> = [];
  private lastMessageId: string | null = null;
  private pollingInterval: number | null = null;
  private timeout: number | null = null;
  private activityCheckInterval: number | null = null;
  private socket: Socket | null = null;
  private currentUserId: string | null = null;
  private users: CollaborationUser[] = [];
  private listeners: SocketListeners = {
    connect: () => {},
    disconnect: () => {},
    message: () => {},
    operation: () => {},
    userJoined: () => {},
    userLeft: () => {},
    userStatusChange: () => {},
    contentSync: () => {},
    titleSync: () => {},
    error: () => {}
  };
  
  constructor() {
    // 初始化时添加Storage事件监听器
    window.addEventListener('storage', this.handleStorageChange);
  }
  
  // 处理localStorage变化事件
  private handleStorageChange = (event: StorageEvent) => {
    if (!this.sessionId || !this.connected) return;
    
    // 检查是否是当前会话的消息
    if (event.key === MESSAGE_KEY(this.sessionId) && event.newValue) {
      try {
        const message = JSON.parse(event.newValue) as WebSocketMessage;
        // 只处理比上次处理的消息ID更新的消息
        if (message.messageId && message.messageId !== this.lastMessageId) {
          this.lastMessageId = message.messageId;
          this.receiveMessage(message);
        }
      } catch (error) {
        console.error('解析消息错误:', error);
      }
    }
  };

  // 处理localStorage事件，用于跨标签页通信
  private handleStorageEvent = (event: StorageEvent) => {
    // 只处理与当前会话相关的事件
    if (!this.sessionId || !event.key || !event.newValue) return;
    
    // 检查是否是我们关心的消息
    if (event.key === MESSAGE_KEY(this.sessionId)) {
      try {
        const message = JSON.parse(event.newValue) as WebSocketMessage;
        
        // 避免处理自己发送的消息
        if (message.messageId === this.lastMessageId) return;
        
        // 处理消息
        this.receiveMessage(message);
      } catch (error) {
        console.error('解析消息错误:', error);
      }
    }
  };

  // 生成用户名的公共方法
  public generateUserName(sessionId: string): string {
    try {
      // 从localStorage获取当前会话的用户列表
      const usersData = localStorage.getItem(USERS_KEY(sessionId));
      const users = usersData ? JSON.parse(usersData) : [];
      
      // 从localStorage获取或初始化计数器
      let counter = 1;
      const storedCounter = localStorage.getItem(USER_COUNTER_KEY(sessionId));
      if (storedCounter) {
        counter = parseInt(storedCounter, 10);
      }
      
      // 生成新用户名
      let userName: string;
      do {
        userName = `${USER_NAME_PREFIX}${counter}`;
        counter++;
      } while (users.some((user: any) => user.name === userName));
      
      // 保存更新后的计数器
      localStorage.setItem(USER_COUNTER_KEY(sessionId), counter.toString());
      
      return userName;
    } catch (error) {
      console.error('生成用户名错误:', error);
      // 发生错误时返回带随机数的用户名
      return `${USER_NAME_PREFIX}${Math.floor(Math.random() * 10000)}`;
    }
  }

  // 重置会话计数器
  private resetSessionCounter(): void {
    // 清理不再使用的会话数据
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(STORAGE_PREFIX) && key.includes('_clients_')) {
        try {
          const clients = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(clients) && clients.length === 0) {
            // 找到会话ID
            const sessionId = key.replace(`${STORAGE_PREFIX}clients_`, '');
            // 清理相关的所有数据
            localStorage.removeItem(CLIENTS_KEY(sessionId));
            localStorage.removeItem(CONTENT_KEY(sessionId));
            localStorage.removeItem(USERS_KEY(sessionId));
            localStorage.removeItem(MESSAGE_KEY(sessionId));
            localStorage.removeItem(LAST_MESSAGE_ID_KEY(sessionId));
            localStorage.removeItem(`${STORAGE_PREFIX}counter_${sessionId}`);
          }
        } catch (error) {
          console.error('清理会话数据错误:', error);
        }
      }
    }
  }

  // 检查连接状态
  public isConnected(): boolean {
    return this.connected;
  }
  
  // 获取当前会话ID
  getSessionId(): string | null {
    return this.sessionId || globalSessionId;
  }
  
  // 获取当前用户ID
  getUserId(): string {
    return this.userId || globalUserId || '';
  }

  // 连接到WebSocket服务器
  public async connect(sessionId: string, userId?: string, userName?: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // 如果已经连接到相同会话，直接返回成功
        if (this.connected && this.sessionId === sessionId && this.userId === userId) {
          console.log("已经连接到会话:", sessionId);
          
          // 检查用户是否仍然在线，可能是重新连接
          this.sendUserStatus(this.userId, UserStatus.ONLINE);
          
          // 开始活动状态检查定时器
          this.startActivityCheck();
          
          // 通知连接状态变化
          this.notifyConnectionStatusChange(true);
          
          // 启动清理定时器
          this.startCleanupInterval();
          
          resolve(true);
          return;
        }
        
        // 如果已经连接到其他会话，先断开
        if (this.connected || globalConnected) {
          console.log("已经连接，先断开");
          this.disconnect();
        }
        
        // 保存会话ID和用户信息
        this.sessionId = sessionId;
        globalSessionId = sessionId;
        
        // 如果没有指定用户ID，生成一个
        if (!userId) {
          userId = uuidv4();
        }
        this.userId = userId;
        globalUserId = userId;
        
        // 如果没有指定用户名，生成一个
        if (!userName) {
          userName = this.generateUserName(sessionId);
        }
        this.userName = userName;
        
        console.log(`尝试连接到会话: ${sessionId}, 用户ID: ${userId}, 用户名: ${userName}`);
        
        // 注册storage事件监听器
        window.addEventListener('storage', this.handleStorageEvent);
        
        // 获取当前会话的用户列表
        let usersData = localStorage.getItem(USERS_KEY(sessionId));
        let users = usersData ? JSON.parse(usersData) : [];
        
        // 检查会话用户数量限制
        if (users.length >= 8) {
          throw new Error('会话人数已达到上限（最多8人）');
        }
        
        // 检查用户名是否重复
        const isDuplicateName = users.some((u: CollaborationUser) => 
          u.name.toLowerCase() === (userName || '').toLowerCase() && u.id !== userId
        );
        
        if (isDuplicateName) {
          throw new Error('用户名已被使用，请使用其他用户名');
        }
        
        // 检查是否存在同ID的用户，如存在则移除
        users = users.filter((u: CollaborationUser) => u.id !== userId);
        
        // 创建当前用户
        const userColor = this.generateUserColor();
        
        const user: CollaborationUser = {
          id: userId,
          name: userName,
          color: userColor,
          status: UserStatus.ONLINE,
          lastActive: Date.now()
        };
        
        // 添加用户到列表
        users.push(user);
        
        // 保存更新后的用户列表
        localStorage.setItem(USERS_KEY(sessionId), JSON.stringify(users));
        
        // 设置连接状态
        this.connected = true;
        globalConnected = true;
        
        // 开始活动状态检查定时器
        this.startActivityCheck();
        
        // 通知连接状态变化
        this.notifyConnectionStatusChange(true);
        
        // 启动清理定时器
        this.startCleanupInterval();
        
        // 广播用户加入消息
        this.broadcastMessage({
          type: 'join',
          payload: {
            user
          }
        });
        
        resolve(true);
      } catch (error: any) {
        console.error('连接错误:', error);
        this.connected = false;
        globalConnected = false;
        this.notifyConnectionStatusChange(false);
        resolve(false);
        throw error;
      }
    });
  }

  // 开始轮询消息
  private startMessagePolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    // 获取上次处理的消息ID
    if (this.sessionId) {
      this.lastMessageId = localStorage.getItem(LAST_MESSAGE_ID_KEY(this.sessionId)) || '';
    }
    
    // 每秒检查新消息
    this.pollingInterval = window.setInterval(() => {
      if (!this.sessionId || !this.connected) return;
      
      try {
        const messageJson = localStorage.getItem(MESSAGE_KEY(this.sessionId));
        if (messageJson) {
          const message = JSON.parse(messageJson) as WebSocketMessage;
          if (message.messageId && message.messageId !== this.lastMessageId) {
            this.lastMessageId = message.messageId;
            // 保存处理过的消息ID
            localStorage.setItem(LAST_MESSAGE_ID_KEY(this.sessionId), this.lastMessageId);
            this.receiveMessage(message);
          }
        }
      } catch (error) {
        console.error('轮询消息错误:', error);
      }
    }, 200); // 200ms轮询间隔，较快的响应
  }

  // 断开连接
  disconnect(): void {
    if (!this.connected && !globalConnected) return;
    
    try {
      // 如果当前有会话ID，发送离开消息
      if (this.sessionId) {
        console.log(`用户 ${this.userName} (${this.userId}) 断开连接`);
        
        // 发送离线状态
        if (this.userId) {
          this.sendUserStatus(this.userId, UserStatus.OFFLINE);
        }
        
        // 广播离开消息
        if (this.userId) {
          this.broadcastMessage({
            type: 'leave',
            payload: {
              userId: this.userId
            }
          });
        }
        
        // 停止活动检查定时器
        if (this.activityCheckInterval) {
          clearInterval(this.activityCheckInterval);
          this.activityCheckInterval = null;
        }
        
        // 停止轮询消息
        if (this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
        }
        
        // 移除storage事件监听器
        window.removeEventListener('storage', this.handleStorageEvent);
        
        // 执行断开连接处理程序
        this.disconnectionHandlers.forEach(handler => handler());
      }
      
      // 重置状态
      this.connected = false;
      this.sessionId = null;
      this.userId = '';
      
      // 重置全局状态
      globalConnected = false;
      globalSessionId = null;
      globalUserId = null;
      
      // 通知连接状态变化
      this.notifyConnectionStatusChange(false);
      
    } catch (error) {
      console.error("断开连接错误:", error);
    }
  }

  // 发送操作
  sendOperation(operation: Omit<TextOperation, 'timestamp'>): void {
    if (!this.connected || !this.sessionId) return;
    
    try {
      const fullOperation = {
        ...operation,
        timestamp: Date.now()
      };
      
      // 获取当前内容
      let content = localStorage.getItem(CONTENT_KEY(this.sessionId)) || '';
      
      // 更新内容
      if (operation.type === 'insert' && operation.text && operation.position !== undefined) {
        content = this.applyInsert(content, operation.position, operation.text);
      } else if (operation.type === 'delete' && operation.length && operation.position !== undefined) {
        content = this.applyDelete(content, operation.position, operation.length);
      } else if (operation.type === 'sync' && operation.content) {
        content = operation.content;
      }
      
      // 保存内容
      localStorage.setItem(CONTENT_KEY(this.sessionId), content);
      
      // 广播操作
      this.broadcastMessage({
        type: 'operation',
        payload: {
          operation: fullOperation
        }
      });
      
      // 广播内容更新
      this.broadcastMessage({
        type: 'content',
        payload: {
          content,
          fromUserId: operation.userId,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('发送操作错误:', error);
    }
  }

  // 应用插入操作
  private applyInsert(content: string, position: number, text: string): string {
    return content.substring(0, position) + text + content.substring(position);
  }
  
  // 应用删除操作
  private applyDelete(content: string, position: number, length: number): string {
    return content.substring(0, position) + content.substring(position + length);
  }

  // 发送光标位置更新，添加行列信息
  sendCursorPosition(position: number, line: number, column: number): void {
    if (!this.connected || !this.userId || !this.sessionId) return;
    
    this.broadcastMessage({
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
  sendSelectionRange(range: { 
    start: { position: number, line: number, column: number }, 
    end: { position: number, line: number, column: number } 
  }): void {
    if (!this.connected || !this.userId || !this.sessionId) return;
    
    this.broadcastMessage({
      type: 'selection',
      payload: {
        userId: this.userId,
        start: range.start,
        end: range.end
      }
    });
  }

  // 同步内容
  private syncContent(): void {
    if (!this.sessionId || !this.connected) return;
    
    // 获取当前内容
    const content = localStorage.getItem(CONTENT_KEY(this.sessionId)) || '';
    
    // 发送给自己
    this.receiveMessage({
      type: 'content',
      payload: {
        content
      }
    });
  }

  // 广播消息到localStorage
  private broadcastMessage(message: WebSocketMessage): void {
    if (!this.sessionId) return;
    
    try {
      // 添加消息ID和时间戳
      const messageWithId = {
        ...message,
        messageId: uuidv4(),
        timestamp: Date.now()
      };
      
      // 保存到localStorage以触发其他标签页的storage事件
      localStorage.setItem(MESSAGE_KEY(this.sessionId), JSON.stringify(messageWithId));
      
      // 保存最后一条消息的ID
      this.lastMessageId = messageWithId.messageId;
      localStorage.setItem(LAST_MESSAGE_ID_KEY(this.sessionId), this.lastMessageId);
      
      // 自己也要处理这条消息
      this.receiveMessage(messageWithId);
    } catch (error) {
      console.error('广播消息错误:', error);
    }
  }
  
  // 接收消息
  private receiveMessage(message: WebSocketMessage): void {
    console.log(`收到消息: ${message.type}`);
    
    // 处理特殊消息类型
    if (message.type === 'join' && message.payload.user) {
      // 有用户加入
      this.updateLocalUserList(message.payload.user, true);
    } else if (message.type === 'leave' && message.payload.userId) {
      // 有用户离开
      this.removeUserFromActiveList(message.payload.userId);
    } else if (message.type === 'heartbeat' && message.payload.userId) {
      // 处理心跳消息，更新用户的最后活跃时间
      this.updateUserLastActive(message.payload.userId);
    } else if (message.type === 'status' && message.payload.userId && message.payload.status) {
      // 处理状态变更消息，更新用户状态
      this.updateUserStatus(message.payload.userId, message.payload.status as UserStatus);
    } else if (message.type === 'activity' && message.payload.userId) {
      // 处理用户活动通知，更新活动状态为"活跃"
      this.updateUserActivity(message.payload.userId, message.payload.type);
    } else if (message.type === 'sync' && message.payload.users) {
      // 同步用户列表
      const usersData = message.payload.users;
      if (this.sessionId) {
        // 确保所有用户的status字段都是有效的UserStatus类型
        const validatedUsers = usersData.map((user: any) => ({
          ...user,
          status: this.validateUserStatus(user.status)
        }));
        
        localStorage.setItem(USERS_KEY(this.sessionId), JSON.stringify(validatedUsers));
      }
    } else if (message.type === 'request_users') {
      // 收到请求用户列表同步的消息
      console.log("收到请求同步用户列表消息");
      this.syncUsers();
    } else if (message.type === 'request_content' && this.sessionId) {
      // 收到请求内容同步的消息
      console.log("收到请求同步内容消息");
      const content = localStorage.getItem(CONTENT_KEY(this.sessionId)) || '';
      
      // 发送内容同步
      this.broadcastMessage({
        type: 'content',
        payload: {
          content,
          fromUserId: this.userId,
          timestamp: Date.now()
        }
      });
    } else if (message.type === 'selection' && message.payload.userId && message.payload.start && message.payload.end) {
      // 处理选择区域同步的消息
      this.updateSelectionRange(message.payload.userId, message.payload.start, message.payload.end);
    }
    
    // 将消息传递给注册的处理程序
    this.messageHandlers.forEach(handler => handler(message));
  }
  
  // 验证用户状态是否有效，如果无效则返回默认值
  private validateUserStatus(status: any): UserStatus {
    const validStatuses: UserStatus[] = [UserStatus.ONLINE, UserStatus.AWAY, UserStatus.OFFLINE];
    return validStatuses.includes(status) ? status : UserStatus.ONLINE;
  }

  // 更新本地用户列表
  private updateLocalUserList(user: Partial<CollaborationUser>, isAdd: boolean): void {
    if (!this.sessionId) return;
    
    try {
      // 获取用户列表
      let users: CollaborationUser[] = [];
      try {
        const usersJson = localStorage.getItem(USERS_KEY(this.sessionId));
        users = usersJson ? JSON.parse(usersJson) : [];
      } catch (error) {
        console.error('解析用户列表错误:', error);
        users = [];
      }
      
      if (isAdd && user.id && user.name && user.color) {
        // 确保状态是有效的UserStatus
        const validStatus: UserStatus = user.status && 
          [UserStatus.ONLINE, UserStatus.AWAY, UserStatus.OFFLINE].includes(user.status) 
          ? (user.status as UserStatus) : UserStatus.ONLINE;
        
        // 添加用户
        const newUser: CollaborationUser = {
          id: user.id,
          name: user.name,
          color: user.color,
          status: validStatus,
          lastActive: Date.now()
        };
        
        // 检查是否已存在
        const existingIndex = users.findIndex(u => u.id === user.id);
        if (existingIndex !== -1) {
          users[existingIndex] = newUser;
        } else {
          users.push(newUser);
        }
        
        console.log(`添加用户到列表: ${newUser.name} (${newUser.id}), 当前用户数: ${users.length}`);
      } else if (!isAdd && user.id) {
        // 移除用户
        const index = users.findIndex(u => u.id === user.id);
        if (index !== -1) {
          users.splice(index, 1);
          console.log(`从列表移除用户: ${user.id}, 剩余用户数: ${users.length}`);
        }
      }
      
      // 保存回localStorage
      localStorage.setItem(USERS_KEY(this.sessionId), JSON.stringify(users));
      
      // 立即广播更新后的用户列表，确保所有客户端都知道变化
      this.broadcastMessage({
        type: 'sync',
        payload: {
          users
        }
      });
    } catch (error) {
      console.error('更新用户列表错误:', error);
    }
  }

  // 监听消息
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  // 监听连接
  onConnect(handler: ConnectionHandler): void {
    this.connectionHandlers.push(handler);
  }

  // 监听断开连接
  onDisconnect(handler: ConnectionHandler): void {
    this.disconnectionHandlers.push(handler);
  }

  // 同步用户列表
  private syncUsers(): void {
    if (!this.sessionId) return;
    
    try {
      // 获取用户列表
      let users: CollaborationUser[] = [];
      try {
        const usersJson = localStorage.getItem(USERS_KEY(this.sessionId));
        users = usersJson ? JSON.parse(usersJson) : [];
      } catch (error) {
        console.error('解析用户列表错误:', error);
        users = [];
      }
      
      // 确保当前用户在列表中
      if (this.userId && this.userName) {
        let currentUserExists = users.some(u => u.id === this.userId);
        
        if (!currentUserExists) {
          console.log(`当前用户 ${this.userName} (${this.userId}) 不在列表中，添加它`);
          users.push({
            id: this.userId,
            name: this.userName,
            color: this.generateUserColor(),
            status: UserStatus.ONLINE,
            lastActive: Date.now()
          });
          
          // 保存更新的用户列表
          localStorage.setItem(USERS_KEY(this.sessionId), JSON.stringify(users));
        }
      }
      
      console.log(`同步用户列表: 会话=${this.sessionId}, 用户数=${users.length}, 用户=${users.map(u => u.name).join(', ')}`);
      
      // 广播用户列表到所有客户端，包括当前客户端
      this.broadcastMessage({
        type: 'sync',
        payload: {
          users
        }
      });
      
      // 设置定时同步，缩短间隔确保更好同步
      if (this.timeout) {
        clearTimeout(this.timeout);
      }
      this.timeout = window.setTimeout(() => this.syncUsers(), 1000); // 缩短到1秒
    } catch (error) {
      console.error('同步用户列表错误:', error);
    }
  }
  
  // 辅助方法：获取用户列表
  private getUsers(): CollaborationUser[] {
    if (!this.sessionId) return [];
    
    try {
      const usersJson = localStorage.getItem(USERS_KEY(this.sessionId));
      return usersJson ? JSON.parse(usersJson) : [];
    } catch (error) {
      console.error('获取用户列表错误:', error);
      return [];
    }
  }
  
  // 辅助方法：保存用户列表
  private saveUsers(users: CollaborationUser[]): void {
    if (!this.sessionId) return;
    
    try {
      localStorage.setItem(USERS_KEY(this.sessionId), JSON.stringify(users));
    } catch (error) {
      console.error('保存用户列表错误:', error);
    }
  }
  
  // 更新用户状态处理，修复类型比较问题
  private updateUserStatus(userId: string, status: UserStatus): void {
    if (!this.sessionId) return;
    
    const users = this.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex !== -1) {
      // 这里进行正确的类型比较
      const currentStatus = users[userIndex].status;
      
      if (currentStatus !== status) {
        console.log(`更新用户 ${userId} 状态为 ${status}`);
        users[userIndex].status = status;
        users[userIndex].lastActive = Date.now();
        this.saveUsers(users);
        
        // 广播用户状态变化
        this.broadcastMessage({
          type: 'sync',
          payload: {
            users
          }
        });
      }
    }
  }
  
  // 检查用户活动状态，修复状态比较
  private startActivityCheck(): void {
    // 清理已存在的定时器
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
    }
    
    // 每10秒检查一次用户活动状态
    this.activityCheckInterval = window.setInterval(() => {
      if (!this.sessionId) return;
      
      try {
        const users = this.getUsers();
        const now = Date.now();
        let hasChanges = false;
        
        // 检查每个用户的活动状态
        const updatedUsers = users.map(user => {
          // 确保用户状态是有效的UserStatus类型
          let currentStatus: UserStatus = 
            (user.status === UserStatus.ONLINE || user.status === UserStatus.AWAY || 
             user.status === UserStatus.OFFLINE) 
            ? user.status : UserStatus.ONLINE;
          
          // 如果用户是"活跃"状态，但超过了离开超时时间无活动，则变为"离开"
          if ((currentStatus === UserStatus.ONLINE || currentStatus === UserStatus.OFFLINE) && 
              user.lastActive && (now - user.lastActive > AWAY_TIMEOUT)) {
            hasChanges = true;
            console.log(`用户 ${user.name} (${user.id}) 超过${AWAY_TIMEOUT/1000}秒无活动，更新为离开状态`);
            
            return { 
              ...user, 
              status: UserStatus.AWAY
            };
          }
          
          return {
            ...user,
            status: currentStatus
          };
        });
        
        // 确保类型正确
        const typedUsers: CollaborationUser[] = updatedUsers.map(user => ({
          id: user.id,
          name: user.name,
          color: user.color,
          status: this.validateUserStatus(user.status),
          lastActive: user.lastActive,
          cursorPosition: user.cursorPosition,
          selection: user.selection
        }));
        
        // 只有当有变化时才更新
        if (hasChanges) {
          this.saveUsers(typedUsers);
          
          // 广播更新的用户列表
          this.broadcastMessage({
            type: 'sync',
            payload: {
              users: typedUsers
            }
          });
        }
      } catch (error) {
        console.error("检查用户活动状态错误:", error);
      }
    }, 10000); // 每10秒检查一次
  }

  // 更新用户的活动状态
  private updateUserActivity(userId: string, activityType: string): void {
    if (!this.sessionId) return;
    
    try {
      // 获取当前会话的用户列表
      const usersData = localStorage.getItem(USERS_KEY(this.sessionId));
      if (!usersData) return;
      
      const users = JSON.parse(usersData) as CollaborationUser[];
      let updated = false;
      
      // 更新用户状态为活跃
      const updatedUsers = users.map(user => {
        if (user.id === userId && user.status !== UserStatus.ONLINE) {
          updated = true;
          return { 
            ...user, 
            status: UserStatus.ONLINE, 
            lastActive: Date.now() 
          };
        } else if (user.id === userId) {
          // 只更新最后活跃时间
          return { ...user, lastActive: Date.now() };
        }
        return user;
      });
      
      // 保存更新后的用户列表
      localStorage.setItem(USERS_KEY(this.sessionId), JSON.stringify(updatedUsers));
      
      // 如果状态有变化，广播状态变化
      if (updated) {
        this.broadcastMessage({
          type: 'sync',
          payload: {
            users: updatedUsers
          }
        });
      }
    } catch (error) {
      console.error("更新用户活动状态错误:", error);
    }
  }

  // 更新用户的最后活跃时间
  private updateUserLastActive(userId: string): void {
    if (!this.sessionId) return;
    
    try {
      // 获取当前会话的用户列表
      const usersData = localStorage.getItem(USERS_KEY(this.sessionId));
      if (!usersData) return;
      
      const users = JSON.parse(usersData) as CollaborationUser[];
      
      // 更新用户的最后活跃时间
      const now = Date.now();
      let userUpdated = false;
      
      const updatedUsers = users.map(user => {
        if (user.id === userId) {
          userUpdated = true;
          // 更新时间戳，如果状态是"离开"且有心跳，则更新为"在线"
          return { 
            ...user, 
            lastActive: now,
            status: user.status === UserStatus.AWAY ? UserStatus.ONLINE : user.status
          };
        }
        return user;
      });
      
      // 仅当有更新时才保存
      if (userUpdated) {
        localStorage.setItem(USERS_KEY(this.sessionId), JSON.stringify(updatedUsers));
        
        // 广播用户状态更新
        this.broadcastMessage({
          type: 'sync',
          payload: {
            users: updatedUsers
          }
        });
      }
    } catch (error) {
      console.error("更新用户活跃时间错误:", error);
    }
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

  // 生成随机用户颜色
  private generateUserColor(): string {
    // 预定义的颜色数组
    const colors = [
      '#F44336', '#E91E63', '#9C27B0', '#673AB7', 
      '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
      '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
      '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'
    ];
    
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // 发送用户即将离开的消息
  sendUserLeaving(userId: string): void {
    if (!this.connected || !this.sessionId) return;
    
    try {
      console.log(`发送用户 ${userId} 离开消息`);
      
      this.broadcastMessage({
        type: 'leave',
        payload: {
          userId
        }
      });
      
      // 从用户列表中移除
      this.removeUserFromActiveList(userId);
    } catch (error) {
      console.error("发送用户离开消息错误:", error);
    }
  }
  
  // 从活跃用户列表中移除用户
  private removeUserFromActiveList(userId: string): void {
    if (!this.sessionId) return;
    
    try {
      // 获取当前会话的用户列表
      const usersData = localStorage.getItem(USERS_KEY(this.sessionId));
      if (!usersData) return;
      
      const users = JSON.parse(usersData) as CollaborationUser[];
      
      // 过滤掉要移除的用户
      const updatedUsers = users.filter(user => user.id !== userId);
      
      // 保存更新后的用户列表
      localStorage.setItem(USERS_KEY(this.sessionId), JSON.stringify(updatedUsers));
      
      // 广播更新后的用户列表
      this.broadcastMessage({
        type: 'sync',
        payload: {
          users: updatedUsers
        }
      });
    } catch (error) {
      console.error("从用户列表移除用户错误:", error);
    }
  }
  
  // 发送用户状态变化
  sendUserStatus(userId: string, status: UserStatus): void {
    if (!this.connected || !this.sessionId) return;
    
    try {
      this.broadcastMessage({
        type: 'status',
        payload: {
          userId,
          status
        }
      });
      
      // 如果状态是离线，从用户列表中移除
      if (status === UserStatus.OFFLINE) {
        this.removeUserFromActiveList(userId);
      } else if (this.sessionId) {
        // 更新用户状态
        const usersData = localStorage.getItem(USERS_KEY(this.sessionId));
        if (usersData) {
          const users = JSON.parse(usersData) as CollaborationUser[];
          const updatedUsers = users.map(user => {
            if (user.id === userId) {
              return { ...user, status, lastActive: Date.now() };
            }
            return user;
          });
          
          // 保存更新后的用户列表
          localStorage.setItem(USERS_KEY(this.sessionId), JSON.stringify(updatedUsers));
          
          // 广播更新的用户列表
          this.broadcastMessage({
            type: 'sync',
            payload: {
              users: updatedUsers
            }
          });
        }
      }
    } catch (error) {
      console.error("发送用户状态变化错误:", error);
    }
  }
  
  // 发送用户活动通知（输入、点击等）
  sendUserActivity(userId: string, activityType: string): void {
    if (!this.connected || !this.sessionId) return;
    
    try {
      // 发送活动通知
      this.broadcastMessage({
        type: 'activity',
        payload: {
          userId,
          type: activityType,
          timestamp: Date.now()
        }
      });
      
      // 同时更新用户状态为"活跃"
      this.updateUserStatus(userId, UserStatus.ONLINE);
    } catch (error) {
      console.error("发送用户活动通知错误:", error);
    }
  }
  
  // 心跳检测
  sendHeartbeat(userId: string): void {
    if (!this.connected || !this.sessionId) return;
    
    try {
      // 获取用户列表
      const usersData = localStorage.getItem(USERS_KEY(this.sessionId));
      if (usersData) {
        const users = JSON.parse(usersData) as CollaborationUser[];
        
        // 检查非活跃用户
        const now = Date.now();
        const updatedUsers = users.map(user => {
          if (user.id === userId) {
            // 只更新时间戳，不改变当前状态
            return { ...user, lastActive: now };
          }
          return user;
        });
        
        // 移除超过离线超时时间没有活动的用户
        const activeUsers = updatedUsers.filter(user => {
          // 如果用户没有lastActive字段或lastActive超过离线超时时间，认为离线
          if (!user.lastActive || now - user.lastActive > OFFLINE_TIMEOUT) {
            console.log(`用户 ${user.name} (${user.id}) 超时，从活跃列表移除`);
            // 广播用户离开消息
            this.broadcastMessage({
              type: 'leave',
              payload: {
                userId: user.id
              }
            });
            return false;
          }
          
          return true;
        });
        
        // 保存更新后的用户列表
        localStorage.setItem(USERS_KEY(this.sessionId), JSON.stringify(activeUsers));
        
        // 如果用户列表变化了，广播更新
        if (activeUsers.length !== users.length || JSON.stringify(activeUsers) !== JSON.stringify(users)) {
          this.broadcastMessage({
            type: 'sync',
            payload: {
              users: activeUsers
            }
          });
        }
      }
    } catch (error) {
      console.error("发送心跳错误:", error);
    }
  }

  // 添加公共方法用于请求同步用户列表
  public requestSyncUsers(): void {
    if (!this.connected || !this.sessionId) return;
    
    try {
      console.log("请求同步用户列表");
      this.broadcastMessage({
        type: 'request_users',
        payload: {
          requesterId: this.userId
        }
      });
      
      // 立即主动同步一次
      this.syncUsers();
    } catch (error) {
      console.error("请求同步用户列表失败:", error);
    }
  }
  
  // 添加一个方法用于请求内容同步
  public requestContent(): void {
    if (!this.connected || !this.sessionId) return;
    
    try {
      console.log("请求同步内容");
      this.broadcastMessage({
        type: 'request_content',
        payload: {
          requesterId: this.userId
        }
      });
    } catch (error) {
      console.error("请求同步内容失败:", error);
    }
  }

  // 更新选择区域范围
  private updateSelectionRange(userId: string, start: { position: number, line: number, column: number }, end: { position: number, line: number, column: number }): void {
    if (!this.connected || !this.sessionId) return;
    
    try {
      // 获取当前会话的用户列表
      const usersData = localStorage.getItem(USERS_KEY(this.sessionId));
      if (!usersData) return;
      
      const users = JSON.parse(usersData) as CollaborationUser[];
      let updated = false;
      
      // 更新选择区域
      const updatedUsers = users.map(user => {
        if (user.id === userId) {
          updated = true;
          return {
            ...user,
            selection: {
              start,
              end
            }
          };
        }
        return user;
      });
      
      // 保存更新后的用户列表
      localStorage.setItem(USERS_KEY(this.sessionId), JSON.stringify(updatedUsers));
      
      // 如果状态有变化，广播状态变化
      if (updated) {
        this.broadcastMessage({
          type: 'sync',
          payload: {
            users: updatedUsers
          }
        });
      }
    } catch (error) {
      console.error("更新选择区域范围错误:", error);
    }
  }

  // 清理离线用户
  private cleanupOfflineUsers(): void {
    if (!this.sessionId) return;
    
    try {
      const usersData = localStorage.getItem(USERS_KEY(this.sessionId));
      if (!usersData) return;
      
      const users = JSON.parse(usersData) as CollaborationUser[];
      const now = Date.now();
      
      // 过滤掉离线用户
      const activeUsers = users.filter(user => {
        // 如果用户没有lastActive字段或lastActive超过离线超时时间，移除
        if (!user.lastActive || now - user.lastActive > OFFLINE_TIMEOUT) {
          console.log(`用户 ${user.name} (${user.id}) 超时，从活跃列表移除`);
          return false;
        }
        
        // 如果用户状态是"离开"且超过2分钟无活动，也移除
        if (user.status === UserStatus.AWAY && now - user.lastActive > 2 * 60 * 1000) {
          console.log(`离开状态用户 ${user.name} (${user.id}) 超过2分钟无活动，移除`);
          return false;
        }
        
        return true;
      });
      
      // 如果有用户被移除，更新存储并广播
      if (activeUsers.length !== users.length) {
        localStorage.setItem(USERS_KEY(this.sessionId), JSON.stringify(activeUsers));
        this.broadcastMessage({
          type: 'sync',
          payload: {
            users: activeUsers
          }
        });
      }
    } catch (error) {
      console.error("清理离线用户错误:", error);
    }
  }

  // 启动定期清理
  private startCleanupInterval(): void {
    // 每30秒清理一次离线用户
    setInterval(() => {
      this.cleanupOfflineUsers();
    }, 30 * 1000);
  }
}

// 创建单例实例
export const websocketService = new WebSocketClient(); 