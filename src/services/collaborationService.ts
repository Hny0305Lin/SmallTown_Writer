import { v4 as uuidv4 } from 'uuid';
import type { UserStatus } from './websocketService';
import { TextOperation } from '../types/TextOperation';

// 光标位置信息接口
export interface CursorPosition {
  position: number;
  line: number;
  column: number;
}

// 选择范围接口
export interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}

// 文本操作类型定义
export interface TextOperation {
  type: 'insert' | 'delete' | 'sync' | 'retry';
  userId: string;
  position?: number;
  text?: string;
  length?: number;
  content?: string;
  timestamp?: number;
  fromUserId?: string; // 标识操作来源的用户ID
}

// 协作用户接口
export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  status: UserStatus;
  lastActive?: number;
  cursorPosition?: CursorPosition;
  selection?: SelectionRange;
}

// 协作会话状态
interface CollaborationSession {
  id: string;
  documentId: string;
  users: CollaborationUser[];
  content: string;
  operations: TextOperation[];
}

// 存储所有活跃的协作会话
const sessions: Record<string, CollaborationSession> = {};

// 颜色列表，用于为新用户分配
const colors = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7', 
  '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#CDDC39'
];

// 生成新用户颜色
const getRandomColor = (): string => {
  const randomIndex = Math.floor(Math.random() * colors.length);
  return colors[randomIndex];
};

// 创建新的协作会话
export const createSession = (documentId: string, initialContent: string): string => {
  const sessionId = uuidv4();
  sessions[sessionId] = {
    id: sessionId,
    documentId,
    users: [],
    content: initialContent,
    operations: []
  };
  return sessionId;
};

// 加入协作会话
export const joinSession = (sessionId: string, userName: string): CollaborationUser | null => {
  const session = sessions[sessionId];
  if (!session) return null;

  const userId = uuidv4();
  const user: CollaborationUser = {
    id: userId,
    name: userName,
    color: getRandomColor(),
    status: 'active'
  };

  session.users.push(user);
  return user;
};

// 离开协作会话
export const leaveSession = (sessionId: string, userId: string): boolean => {
  const session = sessions[sessionId];
  if (!session) return false;

  const userIndex = session.users.findIndex(u => u.id === userId);
  if (userIndex === -1) return false;

  session.users.splice(userIndex, 1);
  
  // 如果没有用户了，可以清理会话
  if (session.users.length === 0) {
    delete sessions[sessionId];
  }
  
  return true;
};

// 应用文本操作到内容
const applyOperation = (content: string, operation: TextOperation): string => {
  if (operation.type === 'insert' && operation.text && operation.position !== undefined) {
    return content.substring(0, operation.position) + 
           operation.text + 
           content.substring(operation.position);
  } else if (operation.type === 'delete' && operation.length && operation.position !== undefined) {
    return content.substring(0, operation.position) + 
           content.substring(operation.position + operation.length);
  } else if (operation.type === 'sync' && operation.content) {
    // 直接使用同步内容
    return operation.content;
  }
  return content;
};

// 执行操作并广播给其他用户
export const executeOperation = (
  sessionId: string, 
  operation: Omit<TextOperation, 'timestamp'>
): TextOperation | null => {
  const session = sessions[sessionId];
  if (!session) return null;

  const fullOperation: TextOperation = {
    ...operation,
    timestamp: Date.now()
  };

  // 应用操作到文档内容
  session.content = applyOperation(session.content, fullOperation);
  
  // 保存操作历史
  session.operations.push(fullOperation);
  
  return fullOperation;
};

// 获取会话信息
export const getSessionInfo = (sessionId: string): CollaborationSession | null => {
  return sessions[sessionId] || null;
};

// 更新用户光标位置
export const updateUserCursor = (
  sessionId: string, 
  userId: string, 
  position: number
): boolean => {
  const session = sessions[sessionId];
  if (!session) return false;

  const user = session.users.find(u => u.id === userId);
  if (!user) return false;

  user.cursorPosition = { position, line: 0, column: 0 };
  return true;
};

// 定义操作验证结果类型
interface OperationValidationResult {
  isValid: boolean;
  reason?: string;
}

// 验证操作是否有效
export const validateOperation = (
  incomingOp: TextOperation,
  existingOps: TextOperation[]
): OperationValidationResult => {
  // 如果没有现有操作，默认新操作有效
  if (!existingOps || existingOps.length === 0) {
    return { isValid: true };
  }

  // 确保操作有时间戳
  if (!incomingOp.timestamp) {
    return { 
      isValid: false, 
      reason: '操作缺少时间戳' 
    };
  }

  // 检查冲突
  const conflictingOps = existingOps.filter(existingOp => {
    // 忽略自己的操作
    if (existingOp.fromUserId && incomingOp.fromUserId && 
        existingOp.fromUserId === incomingOp.fromUserId) {
      return false;
    }
    
    // 确保两个操作都有时间戳
    const existingTimestamp = existingOp.timestamp || 0;
    const incomingTimestamp = incomingOp.timestamp || 0;
    
    // 检查两个操作是否在相同时间段内（1秒内的操作可能冲突）
    return Math.abs(existingTimestamp - incomingTimestamp) < 1000;
  });

  if (conflictingOps.length > 0) {
    return {
      isValid: false,
      reason: `操作与${conflictingOps.length}个现有操作冲突`
    };
  }

  return { isValid: true };
};

// 转换操作以处理并发编辑
export const transformOperation = (
  incomingOp: TextOperation,
  existingOps: TextOperation[]
): TextOperation => {
  // 如果没有现有操作，直接返回输入操作
  if (!existingOps || existingOps.length === 0) {
    return incomingOp;
  }

  // 创建操作的副本以避免修改原始对象
  let transformedOp = { ...incomingOp };

  // 按时间戳排序现有操作
  const sortedOps = [...existingOps].sort((a, b) => {
    const timestampA = a.timestamp || 0;
    const timestampB = b.timestamp || 0;
    return timestampA - timestampB;
  });

  // 应用转换算法
  for (const existingOp of sortedOps) {
    // 跳过由相同用户生成的操作
    if (existingOp.fromUserId && transformedOp.fromUserId && 
        existingOp.fromUserId === transformedOp.fromUserId) {
      continue;
    }

    // 操作转换逻辑 (根据您的OT实现调整)
    // 这是一个简化示例，实际OT算法会更复杂
    if (existingOp.type === 'insert' && transformedOp.type === 'insert') {
      // 如果两个插入操作，并且现有操作的位置在新操作之前或相同
      // 则新操作的位置需要向后移动
      if (existingOp.position <= transformedOp.position) {
        transformedOp.position += (existingOp.text || '').length;
      }
    } else if (existingOp.type === 'delete' && transformedOp.type === 'insert') {
      // 如果存在删除操作，而我们要插入，需要调整插入位置
      if (existingOp.position < transformedOp.position) {
        transformedOp.position -= (existingOp.length || 0);
      }
    } else if (existingOp.type === 'insert' && transformedOp.type === 'delete') {
      // 如果存在插入操作，而我们要删除，需要调整删除位置
      if (existingOp.position <= transformedOp.position) {
        transformedOp.position += (existingOp.text || '').length;
      }
    } else if (existingOp.type === 'delete' && transformedOp.type === 'delete') {
      // 两个删除操作的处理...
      // 简化版，实际实现可能更复杂
      if (existingOp.position < transformedOp.position) {
        transformedOp.position -= (existingOp.length || 0);
      }
    }
  }

  return transformedOp;
};

// 获取当前文档内容
export const getDocumentContent = (sessionId: string): string | null => {
  const session = sessions[sessionId];
  return session ? session.content : null;
};

// 获取会话中的所有用户
export const getSessionUsers = (sessionId: string): CollaborationUser[] => {
  const session = sessions[sessionId];
  return session ? [...session.users] : [];
};

// 简单的文本操作管理，每个文档有一个
export class TextOperationManager {
  private operations: TextOperation[] = [];
  private users: Map<string, CollaborationUser> = new Map();
  
  // 添加用户
  addUser(user: CollaborationUser): void {
    this.users.set(user.id, user);
  }
  
  // 删除用户
  removeUser(userId: string): void {
    this.users.delete(userId);
  }
  
  // 获取用户
  getUser(userId: string): CollaborationUser | undefined {
    return this.users.get(userId);
  }
  
  // 获取所有用户
  getUsers(): CollaborationUser[] {
    return Array.from(this.users.values());
  }
  
  // 更新用户光标位置
  updateUserCursor(userId: string, position: number, line: number, column: number): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    
    user.cursorPosition = { position, line, column };
    return true;
  }
  
  // 添加操作
  addOperation(operation: TextOperation): void {
    // 为操作添加时间戳
    if (!operation.timestamp) {
      operation.timestamp = Date.now();
    }
    
    this.operations.push(operation);
    
    // 只保留最近的100个操作，避免内存泄漏
    if (this.operations.length > 100) {
      this.operations = this.operations.slice(-100);
    }
  }
  
  // 获取最近的操作
  getOperations(since?: number): TextOperation[] {
    if (!since) {
      return [...this.operations];
    }
    
    return this.operations.filter(op => (op.timestamp || 0) > since);
  }
  
  // 解决冲突：
  // 1. 保留时间戳较新的操作
  // 2. 如果时间戳相同，根据用户ID排序
  resolveConflict(existingOp: TextOperation, incomingOp: TextOperation): TextOperation {
    const existingTime = existingOp.timestamp || 0;
    const incomingTime = incomingOp.timestamp || 0;
    
    if (incomingTime > existingTime) {
      return incomingOp;
    } else if (incomingTime < existingTime) {
      return existingOp;
    } else {
      // 时间戳相同，按用户ID字典序
      return existingOp.userId.localeCompare(incomingOp.userId) > 0 ? existingOp : incomingOp;
    }
  }
}

// 创建协作会话管理器 - 单例
export const collaborationService = {
  sessions: new Map<string, TextOperationManager>(),
  
  // 获取会话，如果不存在则创建
  getSession(sessionId: string): TextOperationManager {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new TextOperationManager());
    }
    return this.sessions.get(sessionId)!;
  },
  
  // 添加操作到会话
  addOperation(sessionId: string, operation: TextOperation): void {
    const session = this.getSession(sessionId);
    session.addOperation(operation);
  },
  
  // 获取会话的操作
  getOperations(sessionId: string, since?: number): TextOperation[] {
    const session = this.getSession(sessionId);
    return session.getOperations(since);
  }
};

// 管理用户状态
export const updateUserStatus = (
  userId: string, 
  status: UserStatus, 
  userList: { id: string; name: string; status: UserStatus }[]
): { id: string; name: string; status: UserStatus }[] => {
  const updatedList = [...userList];
  const userIndex = updatedList.findIndex(user => user.id === userId);
  
  if (userIndex >= 0) {
    // 更新现有用户状态
    updatedList[userIndex] = {
      ...updatedList[userIndex],
      status
    };
  }
  
  return updatedList;
}; 