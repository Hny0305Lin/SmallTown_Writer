import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Paper, Typography, TextField, Button, Snackbar, Alert, IconButton, Tooltip, Avatar, Chip, Stack, Menu, MenuItem, ListSubheader, Divider } from '@mui/material';
import { Save as SaveIcon, People as PeopleIcon, Link as LinkIcon, ContentCopy, Menu as MenuIcon, ExitToApp as ExitToAppIcon, Group as GroupIcon, Share as ShareIcon, ChevronLeft, ChevronRight, Groups as GroupsIcon } from '@mui/icons-material';
import { useNovelStore } from '../../store/novelStore';
import { v4 as uuidv4 } from 'uuid';
import { websocketService, UserStatus } from '../../services/websocketService';
import { CollaborationUser } from '../../services/collaborationService';
import { useSettingsStore } from '../../store/settingsStore';

// 引入自定义样式组件用于光标显示
import styled from '@emotion/styled';

// 用户光标组件
const UserCursor = styled.div<{ color: string, top: number, left: number }>`
  position: absolute;
  width: 2px;
  height: 20px;
  background-color: ${props => props.color};
  top: ${props => props.top}px;
  left: ${props => props.left}px;
  z-index: 10;
  &::after {
    content: attr(data-name);
    position: absolute;
    top: -18px;
    left: 0;
    background-color: ${props => props.color};
    color: white;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
  }
`;

// 用户选择区域组件
const UserSelection = styled.div<{ color: string, top: number, left: number, width: number, height: number }>`
  position: absolute;
  background-color: ${props => `${props.color}33`}; /* 添加透明度 */
  top: ${props => props.top}px;
  left: ${props => props.left}px;
  width: ${props => props.width}px;
  height: ${props => props.height}px;
  z-index: 5;
  pointer-events: none;
`;

// 定义光标和选择区域接口
interface UserCursorInfo {
  userId: string;
  name: string;
  color: string;
  position: number;
  line: number;
  column: number;
  timestamp: number;
}

interface UserSelectionInfo {
  userId: string;
  name: string;
  color: string;
  start: { line: number, column: number, position: number };
  end: { line: number, column: number, position: number };
  timestamp: number;
}

interface NovelEditorProps {
  toggleSidebar?: () => void;
  sidebarVisible?: boolean;
  autoCollaboration?: boolean;
}

export default function NovelEditor({ toggleSidebar, sidebarVisible, autoCollaboration = false }: NovelEditorProps) {
  const { currentNovel, updateNovel, setCollaborationActive, deselectNovel } = useNovelStore();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [saveMessage, setSaveMessage] = useState({ open: false, type: 'success', message: '' });
  const [collaborationMode, setCollaborationMode] = useState(autoCollaboration);
  const [collaborationLink, setCollaborationLink] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeUsers, setActiveUsers] = useState<CollaborationUser[]>([]);
  const [userId, setUserId] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [cursorColors, setCursorColors] = useState<Record<string, string>>({});
  const hasInitializedCollaboration = useRef(false);
  const contentChangedRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const lastInputValueRef = useRef('');
  const compositionEndTimeoutRef = useRef<number | null>(null);
  const collaborationInitializedRef = useRef(false);
  const { getNovelSettings } = useSettingsStore();

  // 添加光标和选择区域状态
  const [userCursors, setUserCursors] = useState<UserCursorInfo[]>([]);
  const [userSelections, setUserSelections] = useState<UserSelectionInfo[]>([]);
  const [cursorVisibility, setCursorVisibility] = useState<boolean>(true);
  const editorMeasureRef = useRef<DOMRect | null>(null);
  const textMetricsRef = useRef<{ lineHeight: number, charWidth: number }>({ lineHeight: 20, charWidth: 8 });

  const [userListAnchorEl, setUserListAnchorEl] = useState<null | HTMLElement>(null);
  const showUserList = Boolean(userListAnchorEl);
  
  // 处理用户列表按钮点击
  const handleUserListClick = (event: React.MouseEvent<HTMLElement>) => {
    setUserListAnchorEl(event.currentTarget);
  };

  const handleUserListClose = () => {
    setUserListAnchorEl(null);
  };

  // 用户列表分组和排序
  const getUserGroups = () => {
    const onlineUsers = activeUsers.filter(user => user.status === UserStatus.ONLINE && user.id !== userId);
    const awayUsers = activeUsers.filter(user => user.status === UserStatus.AWAY && user.id !== userId);
    const currentUser = activeUsers.find(user => user.id === userId);

    // 按最后活跃时间排序
    const sortByLastActive = (a: CollaborationUser, b: CollaborationUser) => {
      return (b.lastActive || 0) - (a.lastActive || 0);
    };

    return {
      currentUser,
      onlineUsers: onlineUsers.sort(sortByLastActive).slice(0, 5),
      awayUsers: awayUsers.sort(sortByLastActive).slice(0, 5),
      totalOnline: onlineUsers.length,
      totalAway: awayUsers.length
    };
  };

  // 处理插入操作
  const handleInsertOperation = useCallback((position: number, text: string) => {
    setContent(prevContent => {
      return prevContent.substring(0, position) + text + prevContent.substring(position);
    });
  }, []);

  // 处理删除操作
  const handleDeleteOperation = useCallback((position: number, length: number) => {
    setContent(prevContent => {
      return prevContent.substring(0, position) + prevContent.substring(position + length);
    });
  }, []);

  // 计算光标位置函数
  const calculateCursorPosition = useCallback((position: number): { line: number, column: number, top: number, left: number } => {
    if (!editorRef.current || !content) return { line: 0, column: 0, top: 0, left: 0 };
    
    // 获取编辑器元素的测量数据
    if (!editorMeasureRef.current && editorRef.current) {
      editorMeasureRef.current = editorRef.current.getBoundingClientRect();
    }
    
    // 分割内容为行
    const lines = content.slice(0, position).split('\n');
    const line = lines.length - 1;
    const column = lines[line].length;
    
    // 计算顶部和左侧位置
    const top = line * textMetricsRef.current.lineHeight;
    const left = column * textMetricsRef.current.charWidth;
    
    return { line, column, top, left };
  }, [content]);

  // 发送光标位置更新
  const sendCursorPosition = useCallback((position: number) => {
    if (!collaborationMode || !userId) return;
    
    const { line, column } = calculateCursorPosition(position);
    
    try {
      websocketService.sendCursorPosition(position, line, column);
    } catch (error) {
      console.error("发送光标位置失败:", error);
    }
  }, [collaborationMode, userId, calculateCursorPosition]);

  // 处理编辑器光标位置变化
  const handleCursorPositionChange = useCallback(() => {
    if (!editorRef.current || !collaborationMode) return;
    
    const position = editorRef.current.selectionStart;
    sendCursorPosition(position);
    
    // 如果有选择区域，也发送选择区域信息
    if (editorRef.current.selectionStart !== editorRef.current.selectionEnd) {
      try {
        const startPos = editorRef.current.selectionStart;
        const endPos = editorRef.current.selectionEnd;
        const startInfo = calculateCursorPosition(startPos);
        const endInfo = calculateCursorPosition(endPos);
        
        websocketService.sendSelectionRange({
          start: { position: startPos, line: startInfo.line, column: startInfo.column },
          end: { position: endPos, line: endInfo.line, column: endInfo.column }
        });
      } catch (error) {
        console.error("发送选择区域失败:", error);
      }
    }
  }, [collaborationMode, sendCursorPosition, calculateCursorPosition]);

  // 处理WebSocket消息
  const handleWebSocketMessage = useCallback((message: any) => {
    if (!message || !message.type) return;

    console.log("收到WebSocket消息:", message.type, message.payload);

    switch (message.type) {
      case 'join':
        if (message.payload.user) {
          console.log("用户加入:", message.payload.user.name);
          
          setActiveUsers(prev => {
            // 检查用户是否已存在
            if (prev.some(u => u.id === message.payload.user.id)) {
              return prev;
            }
            return [...prev, message.payload.user];
          });
          
          // 更新光标颜色映射
          setCursorColors(prev => ({
            ...prev,
            [message.payload.user.id]: message.payload.user.color
          }));
          
          // 当有新用户加入时，主动发送当前内容
          if (collaborationMode && currentNovel && content) {
            console.log("新用户加入，发送当前内容");
            setTimeout(() => {
              websocketService.sendOperation({
                type: 'sync',
                userId,
                content
              });
            }, 500); // 短暂延迟确保新用户已准备好接收
          }
        }
        break;
        
      case 'leave':
        if (message.payload.userId) {
          console.log("用户离开:", message.payload.userId);
          setActiveUsers(prev => prev.filter(user => user.id !== message.payload.userId));
        }
        break;
        
      case 'operation':
        if (message.payload.operation) {
          const op = message.payload.operation;
          // 不处理自己发出的操作
          if (op.userId === userId) return;
          
          console.log(`收到用户 ${op.userId} 的操作:`, op.type);
          
          if (op.type === 'insert' && op.text && op.position !== undefined) {
            // 简单处理插入操作，实际应用中需要更复杂的OT算法
            handleInsertOperation(op.position, op.text);
            contentChangedRef.current = true;
          } else if (op.type === 'delete' && op.length && op.position !== undefined) {
            // 简单处理删除操作
            handleDeleteOperation(op.position, op.length);
            contentChangedRef.current = true;
          } else if (op.type === 'sync' && op.content) {
            // 处理整个内容同步
            console.log("收到完整内容同步");
            setContent(op.content);
            contentChangedRef.current = true;
          }
        }
        break;
        
      case 'cursor':
        if (message.payload.userId && message.payload.userId !== userId) {
          const { userId: cursorUserId, position, line, column } = message.payload;
          
          // 更新当前用户的光标位置
          setUserCursors(prev => {
            // 检查用户是否已存在
            const existingIndex = prev.findIndex(c => c.userId === cursorUserId);
            const user = activeUsers.find(u => u.id === cursorUserId);
            
            if (!user) return prev;
            
            const cursorInfo: UserCursorInfo = {
              userId: cursorUserId,
              name: user.name,
              color: user.color,
              position,
              line,
              column,
              timestamp: Date.now()
            };
            
            if (existingIndex !== -1) {
              const newCursors = [...prev];
              newCursors[existingIndex] = cursorInfo;
              return newCursors;
            } else {
              return [...prev, cursorInfo];
            }
          });
        }
        break;
        
      case 'selection':
        if (message.payload.userId && message.payload.userId !== userId) {
          const { userId: selectionUserId, start, end } = message.payload;
          
          // 更新当前用户的选择区域
          setUserSelections(prev => {
            // 检查用户是否已存在
            const existingIndex = prev.findIndex(s => s.userId === selectionUserId);
            const user = activeUsers.find(u => u.id === selectionUserId);
            
            if (!user) return prev;
            
            const selectionInfo: UserSelectionInfo = {
              userId: selectionUserId,
              name: user.name,
              color: user.color,
              start,
              end,
              timestamp: Date.now()
            };
            
            if (existingIndex !== -1) {
              const newSelections = [...prev];
              newSelections[existingIndex] = selectionInfo;
              return newSelections;
            } else {
              return [...prev, selectionInfo];
            }
          });
        }
        break;
        
      case 'sync':
        if (message.payload.users) {
          console.log("收到用户列表更新:", message.payload.users.length, "个用户");
          setActiveUsers(message.payload.users);
          
          // 更新所有用户的光标颜色
          const newColors: Record<string, string> = {};
          message.payload.users.forEach((user: CollaborationUser) => {
            newColors[user.id] = user.color;
          });
          setCursorColors(newColors);
        }
        break;
        
      case 'content':
        if (message.payload.content !== undefined) {
          // 如果是自己发送的内容更新，忽略
          if (message.payload.fromUserId === userId) return;
          
          console.log(`收到来自用户 ${message.payload.fromUserId} 的内容同步`);
          
          // 更新编辑器内容
          setContent(message.payload.content);
          
          // 如果当前小说有ID，同时更新小说内容，避免保存时覆盖
          if (currentNovel) {
            // 标记内容已经更新，需要再次自动保存
            contentChangedRef.current = true;
            
            // 更新小说内容到store
            updateNovel(currentNovel.id, {
              content: message.payload.content,
              lastEdited: new Date()
            });
            
            console.log("内容已同步到本地，并将触发自动保存");
          }
        }
        break;
    }
  }, [userId, content, currentNovel, updateNovel, collaborationMode, handleInsertOperation, handleDeleteOperation]);

  // 连接到WebSocket
  const connectToWebSocket = useCallback(async () => {
    if (!currentNovel) {
      console.log("无法连接：未选择小说");
      return;
    }
    
    try {
      // 生成协作ID (确保ID为字母数字)
      let collaborationId = currentNovel.etherpadId || `novel_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      collaborationId = collaborationId.replace(/[^a-zA-Z0-9_]/g, '_');
      
      console.log("尝试连接到会话:", collaborationId);
      
      // 确保小说有协作ID
      if (!currentNovel.etherpadId) {
        updateNovel(currentNovel.id, {
          etherpadId: collaborationId
        });
      }
      
      // 生成用户ID
      const newUserId = uuidv4();
      setUserId(newUserId);
      
      // 使用websocketService生成用户名
      const userName = websocketService.generateUserName(collaborationId);
      
      // 设置消息处理程序
      websocketService.onMessage(handleWebSocketMessage);
      
      console.log("正在连接到WebSocket会话:", collaborationId);
      
      // 连接到会话
      const success = await websocketService.connect(
        collaborationId,
        newUserId,
        userName
      );
      
      if (success) {
        console.log("WebSocket连接成功，用户ID:", newUserId);
        
        // 主动添加自己到用户列表
        const currentUser = {
          id: newUserId,
          name: userName,
          color: cursorColors[newUserId] || `#${Math.floor(Math.random()*16777215).toString(16)}`,
          status: UserStatus.ONLINE
        };
        
        // 立即更新用户列表，确保至少有当前用户
        setActiveUsers(prev => {
          // 确保不重复添加
          if (prev.some(u => u.id === newUserId)) {
            return prev;
          }
          return [...prev, currentUser];
        });
        
        // 额外再请求一次用户列表同步，确保看到所有用户
        setTimeout(() => {
          try {
            console.log("请求用户列表同步");
            websocketService.requestSyncUsers();
          } catch (error) {
            console.error("请求用户列表同步失败:", error);
          }
        }, 500);
        
        // 立即发送初始内容
        if (content) {
          try {
            websocketService.sendOperation({
              type: 'sync',
              userId: newUserId,
              content
            });
            console.log("已发送初始内容同步");
          } catch (error) {
            console.error("发送内容同步失败:", error);
          }
        }
      } else {
        console.error("WebSocket连接失败");
        setSaveMessage({
          open: true,
          type: 'error',
          message: '协作模式连接失败，请重试'
        });
        setCollaborationMode(false);
        setCollaborationActive(currentNovel.id, false);
      }
    } catch (error: any) {
      console.error("WebSocket连接错误:", error);
      setSaveMessage({
        open: true,
        type: 'error',
        message: error.message || '协作模式连接错误，请检查网络'
      });
      setCollaborationMode(false);
      setCollaborationActive(currentNovel.id, false);
    }
  }, [currentNovel, handleWebSocketMessage, content, updateNovel, cursorColors]);

  // 断开WebSocket连接
  const disconnectWebSocket = useCallback(() => {
    websocketService.disconnect();
    setActiveUsers([]);
  }, []);

  // 切换协作模式
  const toggleCollaborationMode = useCallback(async () => {
    if (!currentNovel) return;
    
    if (collaborationMode) {
      // 关闭协作模式
      setCollaborationMode(false);
      // 更新全局状态
      setCollaborationActive(currentNovel.id, false);
      disconnectWebSocket();
    } else {
      // 开启协作模式
      setCollaborationMode(true);
      // 更新全局状态
      setCollaborationActive(currentNovel.id, true);
      // 短暂延迟确保状态更新
      setTimeout(async () => {
        await connectToWebSocket();
      }, 100);
    }
  }, [collaborationMode, connectToWebSocket, disconnectWebSocket, currentNovel, setCollaborationActive]);

  useEffect(() => {
    if (currentNovel) {
      setContent(currentNovel.content);
      setTitle(currentNovel.title);
      
      // 为每个小说生成唯一的协作ID
      const collaborationId = currentNovel.etherpadId || `novel_${currentNovel.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      // 修复为使用真实路由而不是锚点
      setCollaborationLink(`${window.location.origin}/collaborate/${collaborationId}`);
      
      // 如果小说没有协作ID，则更新它
      if (!currentNovel.etherpadId) {
        updateNovel(currentNovel.id, {
          etherpadId: collaborationId
        });
      }
    } else {
      setContent('');
      setTitle('');
      setCollaborationLink('');
    }
  }, [currentNovel, updateNovel]);
  
  // 从全局状态初始化协作模式
  useEffect(() => {
    if (currentNovel && currentNovel.collaborationActive && !collaborationInitializedRef.current) {
      console.log("从全局状态初始化协作模式");
      setCollaborationMode(true);
      collaborationInitializedRef.current = true;
      // 短暂延迟确保状态更新
      setTimeout(async () => {
        await connectToWebSocket();
      }, 500);
    } else if (currentNovel && autoCollaboration && !hasInitializedCollaboration.current) {
      // 自动开启协作模式
      console.log("自动开启协作模式");
      setCollaborationMode(true);
      setCollaborationActive(currentNovel.id, true);
      hasInitializedCollaboration.current = true;
      // 短暂延迟确保状态更新
      setTimeout(async () => {
        await connectToWebSocket();
      }, 500);
    } else if (currentNovel && !currentNovel.collaborationActive && collaborationMode) {
      // 如果全局状态为非协作但本地状态为协作，更新本地状态
      console.log("同步协作模式为关闭状态");
      setCollaborationMode(false);
    }
  }, [currentNovel, autoCollaboration, connectToWebSocket, collaborationMode, setCollaborationActive]);

  // 组件卸载时不断开连接，除非完全离开应用
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 只有在浏览器关闭/刷新时才断开连接
      disconnectWebSocket();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // 注意这里不再在组件卸载时断开连接
    };
  }, [disconnectWebSocket]);

  const handleCloseSnackbar = () => {
    setSaveMessage({ ...saveMessage, open: false });
  };

  const handleCloseCopySnackbar = () => {
    setCopySuccess(false);
  };

  const copyCollaborationLink = () => {
    navigator.clipboard.writeText(collaborationLink).then(() => {
      setCopySuccess(true);
    });
  };

  // 监测用户活动状态
  useEffect(() => {
    if (!collaborationMode || !userId) return;
    
    // 监听用户在编辑器上的活动
    const handleActivity = () => {
      // 发送活动状态
      try {
        websocketService.sendUserActivity(userId, 'input');
      } catch (error) {
        console.error("发送活动状态失败:", error);
      }
    };
    
    // 鼠标移动监听
    const handleMouseMove = () => {
      if (document.activeElement === editorRef.current) {
        handleActivity();
      }
    };
    
    // 键盘输入监听
    const handleKeyDown = () => {
      handleActivity();
    };
    
    // 编辑器点击监听
    const handleEditorClick = () => {
      handleActivity();
    };
    
    // 如果有编辑器引用，添加事件监听
    if (editorRef.current) {
      editorRef.current.addEventListener('keydown', handleKeyDown);
      editorRef.current.addEventListener('click', handleEditorClick);
      editorRef.current.addEventListener('focus', handleActivity);
    }
    
    // 添加全局鼠标移动监听
    document.addEventListener('mousemove', handleMouseMove);
    
    // 清理函数
    return () => {
      if (editorRef.current) {
        editorRef.current.removeEventListener('keydown', handleKeyDown);
        editorRef.current.removeEventListener('click', handleEditorClick);
        editorRef.current.removeEventListener('focus', handleActivity);
      }
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [collaborationMode, userId, editorRef.current]);

  // 修改handleContentChange函数，添加活动通知
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    
    // 发送用户活动状态
    if (collaborationMode && userId) {
      websocketService.sendUserActivity(userId, 'typing');
    }
    
    // 如果正在进行中文输入，只更新本地内容，不发送操作
    if (isComposing) {
      setContent(newContent);
      return;
    }
    
    // 只有当不是在中文输入过程中时，才处理变更和同步
    if (!isComposing) {
      setContent(newContent);
      lastInputValueRef.current = newContent;
      
      // 标记内容已改变，用于自动保存
      contentChangedRef.current = true;
      
      // 如果不是协作模式或没有选择小说，只更新本地状态
      if (!collaborationMode || !currentNovel) return;
      
      // 尝试发送更改
      setTimeout(() => {
        try {
          websocketService.sendOperation({
            type: 'sync',
            userId,
            content: newContent
          });
          console.log("已同步完整内容");
        } catch (error) {
          console.error("同步内容错误:", error);
        }
      }, 10);
    }
  };
  
  // 重写组合输入处理函数
  const handleCompositionStart = () => {
    console.log("输入法组合输入开始");
    setIsComposing(true);
    
    // 取消之前的组合结束延迟处理（如果有）
    if (compositionEndTimeoutRef.current) {
      window.clearTimeout(compositionEndTimeoutRef.current);
      compositionEndTimeoutRef.current = null;
    }
  };
  
  const handleCompositionEnd = () => {
    console.log("输入法组合输入结束");
    
    // 使用延迟来确保组合输入的值已经更新到输入框
    compositionEndTimeoutRef.current = window.setTimeout(() => {
      setIsComposing(false);
      
      // 组合结束后，获取当前输入框的值
      if (editorRef.current && collaborationMode && currentNovel) {
        const finalContent = editorRef.current.value;
        
        // 如果内容有变化，发送操作
        if (finalContent !== lastInputValueRef.current) {
          console.log("中文输入完成，发送最终内容:", finalContent);
          lastInputValueRef.current = finalContent;
          
          try {
            // 直接发送完整内容同步，不计算差异
            websocketService.sendOperation({
              type: 'sync',
              userId,
              content: finalContent
            });
            
            // 确保状态更新
            setContent(finalContent);
            
            // 标记内容已变化，将触发自动保存
            contentChangedRef.current = true;
          } catch (error) {
            console.error("中文输入后同步内容失败:", error);
          }
        }
      }
      
      compositionEndTimeoutRef.current = null;
    }, 50); // 增加延迟，确保输入框值已更新
  };

  // 添加清理timeout的effect
  useEffect(() => {
    return () => {
      if (compositionEndTimeoutRef.current) {
        window.clearTimeout(compositionEndTimeoutRef.current);
      }
    };
  }, []);

  // 添加窗口关闭事件监听，确保用户离线状态正确传播
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 用户关闭页面前，主动发送离开消息
      if (userId && collaborationMode) {
        try {
          console.log("用户即将离开，发送离开消息");
          websocketService.sendUserLeaving(userId);
          
          // 尝试断开连接
          disconnectWebSocket();
        } catch (leaveError) {
          console.error("发送离开消息失败:", leaveError);
        }
      }
    };
    
    // 注册窗口关闭事件
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // 也添加可见性变化检测
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && userId && collaborationMode) {
        console.log("页面不可见，发送用户状态变化");
        websocketService.sendUserStatus(userId, UserStatus.AWAY);
      } else if (document.visibilityState === 'visible' && userId && collaborationMode) {
        console.log("页面可见，发送用户状态变化");
        websocketService.sendUserStatus(userId, UserStatus.ONLINE);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 心跳检测，定期发送活跃状态
    let heartbeatInterval: number | null = null;
    
    if (collaborationMode && userId) {
      heartbeatInterval = window.setInterval(() => {
        if (userId && collaborationMode) {
          try {
            websocketService.sendHeartbeat(userId);
          } catch (heartbeatError) {
            console.error("发送心跳失败:", heartbeatError);
          }
        }
      }, 20000); // 每20秒发送一次心跳（从30秒缩短）
    }
    
    // 清理函数
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (heartbeatInterval) {
        window.clearInterval(heartbeatInterval);
      }
    };
  }, [userId, collaborationMode, disconnectWebSocket]);

  // 自动保存功能
  useEffect(() => {
    if (!currentNovel) return;
    
    // 获取当前小说的设置
    const novelSettings = getNovelSettings(currentNovel.id);
    
    // 如果不启用自动保存，直接返回
    if (!novelSettings.autoSave) return;
    
    // 根据协作模式选择不同的保存间隔
    const autoSaveInterval = collaborationMode ? 
      Math.min(2000, novelSettings.autoSaveInterval) : // 协作模式下最多2秒保存一次
      novelSettings.autoSaveInterval;
    
    console.log(`自动保存已启用，间隔: ${autoSaveInterval}ms`);
    
    const intervalId = setInterval(() => {
      if (contentChangedRef.current) {
        console.log('自动保存中...');
        // 直接调用updateNovel而不是handleSave，以避免依赖循环
        try {
          updateNovel(currentNovel.id, {
            title, // 同时保存标题
            content,
            lastEdited: new Date()
          });
          contentChangedRef.current = false;
          
          // 显示保存成功提示
          setSaveMessage({
            open: true,
            type: 'success',
            message: '内容已自动保存'
          });
        } catch (error) {
          console.error("自动保存失败:", error);
          setSaveMessage({
            open: true,
            type: 'error',
            message: '自动保存失败，请稍后再试'
          });
        }
      }
    }, autoSaveInterval);

    return () => clearInterval(intervalId);
  }, [currentNovel, collaborationMode, content, title, updateNovel, getNovelSettings, setSaveMessage]);

  // 修改协作模式下显示的用户信息部分
  const renderUserChips = useCallback(() => {
    console.log("渲染用户列表:", activeUsers.length, "个用户, 当前用户ID:", userId);
    
    // 如果用户列表为空但已连接，请求同步
    if (activeUsers.length === 0 && userId && collaborationMode) {
      console.log("用户列表为空，请求同步");
      setTimeout(() => {
        try {
          websocketService.requestSyncUsers();
        } catch (error) {
          console.error("请求用户列表同步失败:", error);
        }
      }, 100);
    }
    
    // 标识当前用户
    const currentUserChip = activeUsers.find(user => user.id === userId);
    // 其他用户按状态分组
    const otherActiveUsers = activeUsers.filter(user => user.id !== userId && user.status === UserStatus.ONLINE);
    const otherOnlineUsers = activeUsers.filter(user => user.id !== userId && user.status === UserStatus.ONLINE);
    const otherAwayUsers = activeUsers.filter(user => user.id !== userId && user.status === UserStatus.AWAY);
    
    // 如果当前用户不在列表中，但我们有userId，手动添加一个当前用户
    const hasCurrentUser = !!currentUserChip;
    
    return (
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {activeUsers.length === 0 && !userId ? (
          <Typography variant="body2" color="text.secondary">
            等待其他用户加入...
          </Typography>
        ) : (
          <>
            {/* 当前用户 - 如果不在activeUsers中但有userId，则手动添加 */}
            {currentUserChip ? (
              <Chip
                key={currentUserChip.id}
                avatar={<Avatar sx={{ bgcolor: currentUserChip.color }}>{currentUserChip.name[0]}</Avatar>}
                label={`${currentUserChip.name} (我)`}
                size="small"
                sx={{ 
                  bgcolor: 'rgba(0, 0, 0, 0.05)',
                  fontWeight: 'bold'
                }}
              />
            ) : userId ? (
              <Chip
                key={userId}
                avatar={<Avatar sx={{ bgcolor: '#' + Math.floor(Math.random()*16777215).toString(16) }}>U</Avatar>}
                label={`当前用户 (我)`}
                size="small"
                sx={{ 
                  bgcolor: 'rgba(0, 0, 0, 0.05)',
                  fontWeight: 'bold'
                }}
              />
            ) : null}
            
            {/* 活跃用户 - 亮色显示 */}
            {otherActiveUsers.map(user => (
              <Chip
                key={user.id}
                avatar={<Avatar sx={{ bgcolor: user.color }}>{user.name[0]}</Avatar>}
                label={`${user.name} (活跃)`}
                size="small"
                sx={{ 
                  bgcolor: 'rgba(0, 0, 0, 0.03)',
                  border: '1px solid',
                  borderColor: 'primary.light'
                }}
              />
            ))}
            
            {/* 在线用户 - 正常显示 */}
            {otherOnlineUsers.map(user => (
              <Chip
                key={user.id}
                avatar={<Avatar sx={{ bgcolor: user.color }}>{user.name[0]}</Avatar>}
                label={user.name}
                size="small"
                sx={{ bgcolor: 'background.paper' }}
              />
            ))}
            
            {/* 离开用户 - 灰色显示 */}
            {otherAwayUsers.map(user => (
              <Chip
                key={user.id}
                avatar={<Avatar sx={{ bgcolor: user.color, opacity: 0.6 }}>{user.name[0]}</Avatar>}
                label={`${user.name} (离开)`}
                size="small"
                sx={{ 
                  bgcolor: 'background.paper',
                  opacity: 0.7,
                  fontStyle: 'italic',
                  color: 'text.secondary'
                }}
              />
            ))}
            
            {/* 显示总人数及状态 */}
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1, display: 'flex', alignItems: 'center' }}>
              共 {activeUsers.length + (hasCurrentUser ? 0 : userId ? 1 : 0)} 人 
              ({otherActiveUsers.length + (currentUserChip?.status === UserStatus.ONLINE ? 1 : 0) + (!hasCurrentUser && userId ? 1 : 0)} 活跃, 
              {otherOnlineUsers.length + (currentUserChip?.status === UserStatus.ONLINE ? 1 : 0)} 在线,
              {otherAwayUsers.length + (currentUserChip?.status === UserStatus.AWAY ? 1 : 0)} 离开)
            </Typography>
          </>
        )}
      </Stack>
    );
  }, [activeUsers, userId, collaborationMode]);

  // 处理退出编辑
  const handleExit = async () => {
    try {
      // 如果处于协作模式，先退出协作
      if (collaborationMode) {
        console.log("退出协作模式");
        // 断开WebSocket连接
        disconnectWebSocket();
        setCollaborationMode(false);
        if (currentNovel?.id) {
          setCollaborationActive(currentNovel.id, false);
        }
      }

      // 保存当前内容
      if (currentNovel && content) {
        console.log("保存小说内容:", currentNovel.id);
        await updateNovel(currentNovel.id, {
          title,
          content,
          lastEdited: new Date()
        });

        // 显示保存成功提示
        setSaveMessage({
          open: true,
          type: 'success',
          message: '内容已保存'
        });

        // 等待一小段时间确保保存完成
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // 确保加载内容被清空
      setContent('');
      setTitle('');
      
      // 取消选择当前小说，返回到列表页面
      console.log("执行deselectNovel()");
      deselectNovel();
      
      // 强制更新清除当前小说的引用
      if (window.location.href.includes('collaborate')) {
        // 如果是协作链接，跳转回主页
        window.location.href = window.location.origin;
      } else {
        // 否则仅强制刷新状态
        setTimeout(() => {
          if (useNovelStore.getState().currentNovel !== null) {
            console.log("强制重置小说选择");
            useNovelStore.setState({ currentNovel: null });
          }
        }, 100);
      }
    } catch (error) {
      console.error("退出编辑时出错:", error);
      setSaveMessage({
        open: true,
        type: 'error',
        message: '保存内容时出错，请重试'
      });
    }
  };

  // 添加WebSocket连接状态检查
  useEffect(() => {
    if (!collaborationMode || !userId || !currentNovel) return;

    // 检查WebSocket连接是否正常
    const checkConnection = () => {
      if (!websocketService.isConnected()) {
        console.log("检测到WebSocket连接断开，尝试重新连接...");
        
        // 如果已有用户ID但连接已断开，尝试重新连接
        setTimeout(async () => {
          try {
            // 重新连接前先清理现有连接
            websocketService.disconnect();
            await connectToWebSocket();
            console.log("WebSocket重新连接成功");
          } catch (error) {
            console.error("WebSocket重新连接失败:", error);
          }
        }, 1000);
      }
    };

    // 定期检查连接状态
    const connectionCheckInterval = setInterval(checkConnection, 10000);

    return () => {
      clearInterval(connectionCheckInterval);
    };
  }, [collaborationMode, userId, currentNovel, connectToWebSocket]);

  // 添加WebSocket连接状态信息
  useEffect(() => {
    if (!collaborationMode) return;

    const handleConnectionStatusChange = (connected: boolean) => {
      if (connected) {
        setSaveMessage({
          open: true,
          type: 'success',
          message: '协作连接已建立'
        });
        
        // 如果重新连接，确保用户列表中有当前用户
        if (userId) {
          setActiveUsers(prev => {
            if (!prev.some(u => u.id === userId)) {
              // 生成随机颜色
              const randomColor = `#${Math.floor(Math.random()*16777215).toString(16)}`;
              return [...prev, {
                id: userId,
                name: `用户_${userId.slice(0, 4)}`,
                color: randomColor,
                status: UserStatus.ONLINE
              }];
            }
            return prev;
          });
        }
      } else {
        setSaveMessage({
          open: true,
          type: 'error',
          message: '协作连接已断开'
        });
      }
    };

    websocketService.onConnectionStatusChange(handleConnectionStatusChange);

    return () => {
      websocketService.offConnectionStatusChange(handleConnectionStatusChange);
    };
  }, [collaborationMode, userId, setSaveMessage]);

  // 添加光标闪烁效果
  useEffect(() => {
    if (!collaborationMode) return;
    
    const cursorBlinkInterval = setInterval(() => {
      setCursorVisibility(prev => !prev);
    }, 500);
    
    return () => {
      clearInterval(cursorBlinkInterval);
    };
  }, [collaborationMode]);

  // 添加编辑器事件监听
  useEffect(() => {
    if (!editorRef.current || !collaborationMode) return;
    
    const handleSelectionChange = () => {
      handleCursorPositionChange();
    };
    
    const handleClick = () => {
      handleCursorPositionChange();
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // 当按下箭头键、Home、End等导航键时更新光标位置
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
        handleCursorPositionChange();
      }
    };
    
    // 计算文本度量信息
    const computeTextMetrics = () => {
      if (!editorRef.current) return;
      
      const styles = window.getComputedStyle(editorRef.current);
      const fontFamily = styles.getPropertyValue('font-family');
      const fontSize = parseFloat(styles.getPropertyValue('font-size'));
      const lineHeight = parseFloat(styles.getPropertyValue('line-height')) || fontSize * 1.2;
      
      // 创建一个临时的span元素来测量字符宽度
      const span = document.createElement('span');
      span.style.fontFamily = fontFamily;
      span.style.fontSize = `${fontSize}px`;
      span.style.position = 'absolute';
      span.style.left = '-9999px';
      span.style.visibility = 'hidden';
      span.textContent = 'X';
      document.body.appendChild(span);
      
      const charWidth = span.getBoundingClientRect().width;
      document.body.removeChild(span);
      
      textMetricsRef.current = { lineHeight, charWidth };
      editorMeasureRef.current = editorRef.current.getBoundingClientRect();
    };
    
    // 立即计算一次
    computeTextMetrics();
    
    // 监听窗口大小变化，重新计算
    const handleResize = () => {
      editorMeasureRef.current = null;
      computeTextMetrics();
    };
    
    editorRef.current.addEventListener('select', handleSelectionChange);
    editorRef.current.addEventListener('click', handleClick);
    editorRef.current.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', handleResize);
    
    return () => {
      if (editorRef.current) {
        editorRef.current.removeEventListener('select', handleSelectionChange);
        editorRef.current.removeEventListener('click', handleClick);
        editorRef.current.removeEventListener('keyup', handleKeyUp);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [collaborationMode, handleCursorPositionChange]);

  // 定期清理过时的光标和选择区域
  useEffect(() => {
    if (!collaborationMode) return;
    
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeoutThreshold = 30000; // 30秒
      
      setUserCursors(prev => prev.filter(cursor => now - cursor.timestamp < timeoutThreshold));
      setUserSelections(prev => prev.filter(selection => now - selection.timestamp < timeoutThreshold));
    }, 10000); // 每10秒清理一次
    
    return () => {
      clearInterval(cleanupInterval);
    };
  }, [collaborationMode]);

  // 渲染用户光标和选择区域
  const renderUserCursorsAndSelections = () => {
    if (!collaborationMode || !editorMeasureRef.current) return null;
    
    return (
      <>
        {cursorVisibility && userCursors.map(cursor => (
          <UserCursor 
            key={`cursor-${cursor.userId}`}
            color={cursor.color}
            top={cursor.line * textMetricsRef.current.lineHeight}
            left={cursor.column * textMetricsRef.current.charWidth}
            data-name={cursor.name}
          />
        ))}
        
        {userSelections.map(selection => {
          // 计算选择区域的位置和大小
          const startTop = selection.start.line * textMetricsRef.current.lineHeight;
          const endTop = selection.end.line * textMetricsRef.current.lineHeight;
          const startLeft = selection.start.column * textMetricsRef.current.charWidth;
          const endLeft = selection.end.column * textMetricsRef.current.charWidth;
          
          // 如果是单行选择
          if (selection.start.line === selection.end.line) {
            return (
              <UserSelection
                key={`selection-${selection.userId}`}
                color={selection.color}
                top={startTop}
                left={startLeft}
                width={endLeft - startLeft}
                height={textMetricsRef.current.lineHeight}
              />
            );
          } else {
            // 多行选择 - 生成多个选择区域
            const elements = [];
            
            // 第一行
            elements.push(
              <UserSelection
                key={`selection-${selection.userId}-start`}
                color={selection.color}
                top={startTop}
                left={startLeft}
                width={editorMeasureRef.current!.width - startLeft}
                height={textMetricsRef.current.lineHeight}
              />
            );
            
            // 中间行
            for (let line = selection.start.line + 1; line < selection.end.line; line++) {
              elements.push(
                <UserSelection
                  key={`selection-${selection.userId}-middle-${line}`}
                  color={selection.color}
                  top={line * textMetricsRef.current.lineHeight}
                  left={0}
                  width={editorMeasureRef.current!.width}
                  height={textMetricsRef.current.lineHeight}
                />
              );
            }
            
            // 最后一行
            elements.push(
              <UserSelection
                key={`selection-${selection.userId}-end`}
                color={selection.color}
                top={endTop}
                left={0}
                width={endLeft}
                height={textMetricsRef.current.lineHeight}
              />
            );
            
            return elements;
          }
        })}
      </>
    );
  };

  // 获取当前小说的设置
  const novelSettings = currentNovel ? getNovelSettings(currentNovel.id) : null;
  
  // 更新编辑器样式
  const editorStyles = {
    '& .MuiInputBase-input': {
      lineHeight: 1.8,
      fontSize: '1.1rem',
      cursor: collaborationMode ? 'text' : 'default',
      fontFamily: `${novelSettings?.fontFamily || 'system-ui'}, sans-serif !important`,
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    },
    '& .MuiInputBase-root': {
      borderRadius: 0,
      fontFamily: 'inherit'
    }
  };

  if (!currentNovel) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <Typography variant="h5" color="text.secondary">
          请从左侧选择一部小说或创建新小说
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        p: 2,
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {toggleSidebar && (
            <Tooltip title={sidebarVisible ? "隐藏小说列表" : "显示小说列表"}>
              <IconButton onClick={toggleSidebar} size="small">
                {sidebarVisible ? <ChevronLeft /> : <ChevronRight />}
              </IconButton>
            </Tooltip>
          )}
          <Typography variant="h6" component="div">
            {currentNovel?.title || '未命名小说'}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* 用户列表按钮 */}
          <Tooltip title="用户列表">
            <IconButton
              onClick={handleUserListClick}
              color={showUserList ? "primary" : "default"}
            >
              <PeopleIcon />
            </IconButton>
          </Tooltip>

          {/* 分享链接按钮 */}
          {collaborationMode && (
            <Tooltip title="分享链接">
              <IconButton onClick={copyCollaborationLink}>
                <ShareIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* 协作模式按钮 */}
          <Tooltip title={collaborationMode ? "退出协作" : "启动协作"}>
            <IconButton
              onClick={toggleCollaborationMode}
              color={collaborationMode ? "primary" : "default"}
            >
              <GroupsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* 协作模式状态提示 */}
      <Box sx={{ mb: 2 }}>
        {collaborationMode ? (
          // 协作模式提示
          <Alert severity="info" sx={{ mb: 2 }}>
            已开启<strong>协作模式</strong>，点击右上角的"用户列表"按钮可查看在线用户。
          </Alert>
        ) : (
          // 只读模式提示
          <Alert severity="info" sx={{ mb: 2 }}>
            当前处于<strong>只读预览模式</strong>，请点击"协作模式"按钮开始编辑。所有更改将自动保存。
          </Alert>
        )}
      </Box>

      <Paper 
        elevation={0} 
        sx={{ 
          p: 2, 
          minHeight: '70vh',
          border: '1px solid',
          borderColor: collaborationMode ? 'primary.light' : 'divider',
          borderRadius: 0,
          position: 'relative',
          backgroundColor: collaborationMode ? 'background.paper' : 'rgba(0,0,0,0.02)'
        }}
      >
        {/* 渲染用户光标和选择区域 */}
        {collaborationMode && renderUserCursorsAndSelections()}
        
        <TextField
          inputRef={editorRef}
          multiline
          fullWidth
          variant="standard"
          value={content}
          onChange={handleContentChange}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onBlur={() => {
            // 失去焦点时，也发送一次当前内容，确保同步
            if (collaborationMode && currentNovel && editorRef.current) {
              try {
                websocketService.sendOperation({
                  type: 'sync',
                  userId,
                  content: editorRef.current.value
                });
                console.log("失焦时同步内容");
              } catch (error) {
                console.error("失焦同步内容错误:", error);
              }
            }
          }}
          placeholder={collaborationMode ? "开始创作您的小说..." : "请先开启协作模式再编辑..."}
          disabled={!collaborationMode}
          InputProps={{
            disableUnderline: true,
            readOnly: !collaborationMode
          }}
          sx={editorStyles}
        />
      </Paper>

      <Snackbar 
        open={saveMessage.open} 
        autoHideDuration={3000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={saveMessage.type === 'success' ? 'success' : 'error'} 
          sx={{ width: '100%' }}
        >
          {saveMessage.message}
        </Alert>
      </Snackbar>

      <Snackbar
        open={copySuccess}
        autoHideDuration={2000}
        onClose={handleCloseCopySnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseCopySnackbar} 
          severity="success" 
          sx={{ width: '100%' }}
        >
          链接已复制到剪贴板
        </Alert>
      </Snackbar>

      {/* 用户列表菜单 */}
      <Menu
        anchorEl={userListAnchorEl}
        open={showUserList}
        onClose={handleUserListClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <ListSubheader>在线用户</ListSubheader>
        {activeUsers.map(user => (
          <MenuItem key={user.id}>
            <Avatar sx={{ bgcolor: user.color, width: 24, height: 24, mr: 1, fontSize: '0.875rem' }}>
              {user.name[0]}
            </Avatar>
            <Typography variant="body2">
              {user.name} {user.id === userId ? '(我)' : ''}
              {user.status === UserStatus.AWAY ? ' (离开)' : ''}
            </Typography>
          </MenuItem>
        ))}
        {activeUsers.length === 0 && (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              暂无其他用户
            </Typography>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
} 