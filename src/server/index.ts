import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

// 获取环境变量，使用默认值
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const SESSION_CLEANUP_INTERVAL = process.env.SESSION_CLEANUP_INTERVAL 
  ? parseInt(process.env.SESSION_CLEANUP_INTERVAL) 
  : 1800000; // 默认30分钟
const MAX_USERS_PER_SESSION = 8; // 限制每个会话最大用户数为8

// 定义消息类型
interface Message {
  type: string;
  payload: any;
  timestamp?: number;
  messageId?: string;
}

// 定义用户类型
interface User {
  id: string;
  name: string;
  color: string;
  status: 'active' | 'away' | 'online' | 'offline';
  lastActive: number;
  socketId?: string; // 与socket.io关联的socketId
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

// 定义会话类型
interface Session {
  id: string;
  users: User[];
  content: string;
  lastUpdated: number;
}

// 存储会话信息
const sessions: Record<string, Session> = {};

// 创建Express应用
const app = express();
app.use(cors());
app.use(express.json());

// 创建HTTP服务器
const server = http.createServer(app);

// 创建Socket.IO服务器
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN, // 使用环境变量
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  }
});

// 生成随机颜色
function generateRandomColor(): string {
  const colors = [
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', 
    '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
    '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
    '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Socket.IO连接处理
io.on('connection', (socket: Socket) => {
  console.log('新连接:', socket.id);
  let currentUser: User | null = null;
  let currentSessionId: string | null = null;

  // 处理加入会话
  socket.on('join', (data: { sessionId: string; userId: string; userName: string }) => {
    try {
      const { sessionId, userId, userName } = data;
      console.log(`用户 ${userName} (${userId}) 尝试加入会话 ${sessionId}`);
      
      // 创建或获取会话
      if (!sessions[sessionId]) {
        console.log(`创建新会话: ${sessionId}`);
        sessions[sessionId] = {
          id: sessionId,
          users: [],
          content: '',
          lastUpdated: Date.now()
        };
      }

      const session = sessions[sessionId];
      
      // 检查会话用户数量限制
      if (session.users.length >= MAX_USERS_PER_SESSION) {
        socket.emit('connection_ack', { 
          success: false, 
          error: '会话人数已达到上限',
          details: `当前会话最多支持${MAX_USERS_PER_SESSION}人同时在线`
        });
        return;
      }

      // 检查用户名是否重复
      const isDuplicateName = session.users.some(u => 
        u.name.toLowerCase() === userName.toLowerCase() && u.id !== userId
      );

      if (isDuplicateName) {
        socket.emit('connection_ack', { 
          success: false, 
          error: '用户名已被使用',
          details: '请使用其他用户名'
        });
        return;
      }
      
      // 查找现有用户
      const existingUserIndex = session.users.findIndex(u => u.id === userId);
      
      // 创建用户对象
      const userColor = generateRandomColor();
      const user: User = {
        id: userId,
        name: userName,
        color: userColor,
        status: 'active',
        lastActive: Date.now(),
        socketId: socket.id
      };
      
      // 如果用户已存在，更新信息
      if (existingUserIndex !== -1) {
        console.log(`更新现有用户: ${userName} (${userId})`);
        sessions[sessionId].users[existingUserIndex] = {
          ...sessions[sessionId].users[existingUserIndex],
          ...user
        };
      } else {
        // 否则添加新用户
        console.log(`添加新用户: ${userName} (${userId})`);
        sessions[sessionId].users.push(user);
      }
      
      // 保存当前用户和会话ID
      currentUser = user;
      currentSessionId = sessionId;
      
      // 加入会话房间
      socket.join(sessionId);
      
      // 广播用户加入消息
      io.to(sessionId).emit('message', {
        type: 'join',
        payload: {
          user
        },
        timestamp: Date.now(),
        messageId: uuidv4()
      });
      
      // 发送当前会话信息给新用户
      socket.emit('message', {
        type: 'sync',
        payload: {
          users: sessions[sessionId].users,
          content: sessions[sessionId].content
        },
        timestamp: Date.now(),
        messageId: uuidv4()
      });

      // 确认连接成功
      socket.emit('connection_ack', { 
        success: true, 
        sessionId, 
        userId,
        message: '成功加入会话'
      });
      
      console.log(`用户 ${userName} (${userId}) 成功加入会话 ${sessionId}, 当前用户数: ${sessions[sessionId].users.length}`);
      
    } catch (error) {
      console.error('加入会话错误:', error);
      socket.emit('connection_ack', { 
        success: false, 
        error: '加入会话失败',
        details: error instanceof Error ? error.message : '未知错误'
      });
    }
  });

  // 处理消息
  socket.on('message', (message: Message) => {
    try {
      if (!currentSessionId || !currentUser) {
        console.error('用户未加入会话');
        return;
      }
      
      const session = sessions[currentSessionId];
      
      // 为消息添加ID和时间戳
      const enrichedMessage = {
        ...message,
        timestamp: Date.now(),
        messageId: uuidv4()
      };
      
      // 处理特定类型的消息
      switch (message.type) {
        case 'operation':
          if (message.payload.operation?.type === 'sync' && message.payload.operation?.content) {
            // 更新会话内容
            session.content = message.payload.operation.content;
            session.lastUpdated = Date.now();
          }
          break;
          
        case 'content':
          if (message.payload.content !== undefined) {
            // 更新会话内容
            session.content = message.payload.content;
            session.lastUpdated = Date.now();
          }
          break;
          
        case 'cursor':
          if (message.payload.userId && currentUser) {
            // 更新用户光标位置
            const userIndex = session.users.findIndex(u => u.id === message.payload.userId);
            if (userIndex !== -1) {
              session.users[userIndex].cursorPosition = {
                position: message.payload.position,
                line: message.payload.line,
                column: message.payload.column
              };
            }
          }
          break;
          
        case 'selection':
          if (message.payload.userId && currentUser) {
            // 更新用户选择区域
            const userIndex = session.users.findIndex(u => u.id === message.payload.userId);
            if (userIndex !== -1) {
              session.users[userIndex].selection = {
                start: message.payload.start,
                end: message.payload.end
              };
            }
          }
          break;
          
        case 'status':
          if (message.payload.userId && message.payload.status) {
            // 更新用户状态
            const userIndex = session.users.findIndex(u => u.id === message.payload.userId);
            if (userIndex !== -1) {
              session.users[userIndex].status = message.payload.status;
              session.users[userIndex].lastActive = Date.now();
            }
          }
          break;
          
        case 'activity':
          if (message.payload.userId) {
            // 更新用户活动
            const userIndex = session.users.findIndex(u => u.id === message.payload.userId);
            if (userIndex !== -1) {
              session.users[userIndex].status = 'active';
              session.users[userIndex].lastActive = Date.now();
            }
          }
          break;
      }
      
      // 广播消息给所有会话成员
      io.to(currentSessionId).emit('message', enrichedMessage);
      
    } catch (error) {
      console.error('处理消息错误:', error);
    }
  });

  // 处理请求同步
  socket.on('request_sync', () => {
    try {
      if (!currentSessionId || !currentUser) {
        console.error('用户未加入会话');
        return;
      }
      
      const session = sessions[currentSessionId];
      
      // 发送同步消息
      socket.emit('message', {
        type: 'sync',
        payload: {
          users: session.users,
          content: session.content
        },
        timestamp: Date.now(),
        messageId: uuidv4()
      });
      
    } catch (error) {
      console.error('请求同步错误:', error);
    }
  });

  // 处理断开连接
  socket.on('disconnect', () => {
    try {
      if (currentSessionId && currentUser) {
        console.log(`用户 ${currentUser.name} (${currentUser.id}) 断开连接`);
        
        // 更新用户状态为离线
        const session = sessions[currentSessionId];
        const userIndex = session.users.findIndex(u => u.id === currentUser?.id);
        
        if (userIndex !== -1) {
          // 移除用户
          session.users.splice(userIndex, 1);
          
          // 广播用户离开消息
          io.to(currentSessionId).emit('message', {
            type: 'leave',
            payload: {
              userId: currentUser.id
            },
            timestamp: Date.now(),
            messageId: uuidv4()
          });
          
          // 更新用户列表
          io.to(currentSessionId).emit('message', {
            type: 'sync',
            payload: {
              users: session.users
            },
            timestamp: Date.now(),
            messageId: uuidv4()
          });
        }
        
        // 如果会话没有用户了，考虑清理会话
        if (session.users.length === 0) {
          // 保留会话内容一段时间以便于重连
          // 实际应用中可以设置一个定时器来清理长时间无人的会话
        }
      }
    } catch (error) {
      console.error('断开连接处理错误:', error);
    }
  });
});

// API路由
// 创建一个新会话
app.post('/api/sessions', (req: Request, res: Response) => {
  try {
    const sessionId = req.body.sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    if (!sessions[sessionId]) {
      sessions[sessionId] = {
        id: sessionId,
        users: [],
        content: req.body.content || '',
        lastUpdated: Date.now()
      };
    }
    
    res.status(201).json({ 
      success: true, 
      sessionId 
    });
  } catch (error) {
    console.error('创建会话错误:', error);
    res.status(500).json({ 
      success: false, 
      error: '创建会话失败' 
    });
  }
});

// 获取会话信息
app.get('/api/sessions/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessions[sessionId]) {
      return res.status(404).json({ 
        success: false, 
        error: '会话不存在' 
      });
    }
    
    const session = sessions[sessionId];
    
    res.json({
      success: true,
      session: {
        id: session.id,
        userCount: session.users.length,
        lastUpdated: session.lastUpdated
      }
    });
  } catch (error) {
    console.error('获取会话信息错误:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取会话信息失败' 
    });
  }
});

// 添加会话清理定时任务
setInterval(() => {
  try {
    console.log('开始清理过期会话...');
    const now = Date.now();
    let cleanedSessions = 0;
    
    // 遍历所有会话，清理超过SESSION_CLEANUP_INTERVAL没有更新的空会话
    for (const sessionId in sessions) {
      const session = sessions[sessionId];
      if (session.users.length === 0 && (now - session.lastUpdated) > SESSION_CLEANUP_INTERVAL) {
        console.log(`清理过期会话: ${sessionId}, 最后更新: ${new Date(session.lastUpdated).toISOString()}`);
        delete sessions[sessionId];
        cleanedSessions++;
      }
    }
    
    console.log(`会话清理完成，共清理 ${cleanedSessions} 个会话`);
  } catch (error) {
    console.error('会话清理过程中出错:', error);
  }
}, SESSION_CLEANUP_INTERVAL);

// API路由增强错误处理
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('API错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

// 添加基础健康检查API
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    sessions: Object.keys(sessions).length
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`协作WebSocket服务器运行在端口 ${PORT}`);
  console.log(`CORS策略: ${CORS_ORIGIN}`);
  console.log(`会话清理间隔: ${SESSION_CLEANUP_INTERVAL}ms`);
}); 