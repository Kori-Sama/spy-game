# 构建阶段
FROM node:20-alpine AS build

WORKDIR /app

# 复制共享类型定义和所有项目文件
COPY shared/ /app/shared/
COPY web/package.json web/pnpm-lock.yaml /app/web/

WORKDIR /app/web
# 安装依赖
RUN npm install -g pnpm
ENV PNPM_HOME=/pnpm
ENV PATH=$PATH:$PNPM_HOME
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install 

# 复制前端源代码
COPY web/ /app/web/

# 构建前端应用
RUN pnpm build

# 运行阶段
FROM nginx:stable-alpine

# 将构建好的内容复制到 nginx 服务目录
COPY --from=build /app/web/dist /usr/share/nginx/html

# 复制自定义 nginx 配置
COPY --from=build /app/web/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]