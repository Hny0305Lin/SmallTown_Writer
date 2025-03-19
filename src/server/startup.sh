#!/bin/bash

# 小镇作家WebSocket服务器启动脚本
echo "启动小镇作家WebSocket服务器..."

# 安装依赖
echo "安装依赖..."
npm install

# 构建项目
echo "构建项目..."
npm run build

# 使用PM2启动服务
echo "使用PM2启动服务..."
npm run pm2

# 设置开机自启
echo "设置开机自启..."
pm2 save
pm2 startup

echo "服务启动完成！服务运行在端口: $(grep PORT .env | cut -d'=' -f2)"
echo "使用以下命令查看日志: pm2 logs smalltown-ws" 