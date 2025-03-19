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