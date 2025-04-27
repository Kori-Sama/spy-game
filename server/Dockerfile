FROM node:20-alpine

WORKDIR /app

# 复制共享类型定义
COPY shared/ /app/shared/
COPY server/package.json server/pnpm-lock.yaml /app/server/

# 安装依赖
WORKDIR /app/server
RUN npm install -g pnpm && pnpm install

# 复制后端源代码
COPY server/ /app/server/

# 暴露端口
EXPOSE 3000

# 启动服务器
CMD ["pnpm", "start"]