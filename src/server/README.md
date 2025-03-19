# 小镇做题家协作服务器

这是小镇做题家应用的WebSocket协作服务器，负责处理实时协作、文档同步和用户状态管理。

## 功能特点

- 实时文档协作与同步
- 用户状态跟踪（在线、离开、离线）
- 基于OT（操作转换）的冲突解决
- 自动会话清理
- 可配置的环境变量

## 安装部署

### 环境要求

- Node.js 14.x 或更高版本
- npm 或 yarn

### 安装依赖

```bash
# 导航到服务器目录
cd src/server

# 安装依赖
npm install
# 或者使用yarn
yarn install
```

### 配置

在`src/server`目录下创建`.env`文件（或编辑现有文件）:

```
# 服务器配置
PORT=3001
CORS_ORIGIN=http://localhost:3000

# 会话管理
SESSION_CLEANUP_INTERVAL=1800000
MAX_USERS_PER_SESSION=20

# 日志设置
LOG_LEVEL=info
```

### 编译TypeScript

```bash
# 编译TypeScript代码
npx tsc
# 或者
npm run build
```

### 启动服务器

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## 生产环境部署

### 使用PM2（推荐）

```bash
# 安装PM2
npm install -g pm2

# 启动服务
pm2 start dist/index.js --name smalltown-collab-server

# 设置开机自启
pm2 startup
pm2 save
```

### 使用Docker部署

```bash
# 构建Docker镜像
docker build -t smalltown-collab-server .

# 运行容器
docker run -d -p 3001:3001 --env-file .env --name smalltown-collab smalltown-collab-server
```

## API参考

### WebSocket事件

| 事件名称 | 描述 | 数据格式 |
|---------|------|---------|
| `joinSession` | 加入协作会话 | `{ sessionId: string, user: { id: string, name: string, status: string } }` |
| `leaveSession` | 离开协作会话 | `{ sessionId: string, userId: string }` |
| `operation` | 文本操作 | `{ type: string, position: number, text?: string, length?: number, fromUserId: string }` |
| `message` | 通用消息 | `{ type: string, payload: any, sender: string, timestamp: number }` |

## 故障排除

### 常见问题

1. **连接被拒绝**
   - 检查服务器是否正在运行
   - 确认防火墙设置允许指定端口

2. **跨域错误**
   - 检查`CORS_ORIGIN`环境变量是否正确设置

3. **内存泄漏**
   - 调整`SESSION_CLEANUP_INTERVAL`确保定期清理未使用的会话 