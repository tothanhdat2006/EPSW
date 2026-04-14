FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.0

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/logger/package.json ./packages/logger/
COPY services/notification-service/package.json ./services/notification-service/
RUN pnpm install --frozen-lockfile
COPY packages/shared-types ./packages/shared-types
COPY packages/logger ./packages/logger
COPY services/notification-service ./services/notification-service
RUN pnpm --filter @dvc/shared-types build
RUN pnpm --filter @dvc/logger build
RUN pnpm --filter @dvc/notification-service build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@9.15.0
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/notification-service/dist ./services/notification-service/dist
COPY --from=builder /app/services/notification-service/package.json ./services/notification-service/
RUN pnpm install --prod --frozen-lockfile
EXPOSE 3004
CMD ["node", "services/notification-service/dist/index.js"]
