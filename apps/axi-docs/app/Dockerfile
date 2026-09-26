# Axi Docs Dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate && pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm run build

ENV NODE_ENV=production
ENV MCP_HTTP_PORT=5173

# 暴露端口
EXPOSE 5173

# 启动统一的 HTTP + MCP 服务（同时提供静态页面和 /docs/api）
CMD ["pnpm", "run", "mcp:http"]
