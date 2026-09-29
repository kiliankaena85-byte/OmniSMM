# docker/laya/Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# Финальный легковесный образ рантайма (CPU / No NPU)
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8150

# Добавляем curl для docker healthcheck
RUN apk add --no-cache curl

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

# Непривилегированный пользователь для безопасности
USER node

EXPOSE 8150

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:8150/health || exit 1

CMD ["node", "dist/server.js"]
