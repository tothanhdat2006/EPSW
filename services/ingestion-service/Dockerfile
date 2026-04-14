FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.0

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/logger/package.json ./packages/logger/
COPY packages/database/package.json ./packages/database/
COPY services/ingestion-service/package.json ./services/ingestion-service/
RUN pnpm install --frozen-lockfile
COPY packages/shared-types ./packages/shared-types
COPY packages/logger ./packages/logger
COPY packages/database ./packages/database
COPY services/ingestion-service ./services/ingestion-service
RUN pnpm --filter @dvc/shared-types build
RUN pnpm --filter @dvc/logger build
RUN pnpm --filter @dvc/database build
RUN pnpm --filter @dvc/ingestion-service build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@9.15.0
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/packages/logger/dist ./packages/logger/dist
COPY --from=builder /app/packages/logger/package.json ./packages/logger/
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/services/ingestion-service/dist ./services/ingestion-service/dist
COPY --from=builder /app/services/ingestion-service/package.json ./services/ingestion-service/
RUN pnpm install --prod --frozen-lockfile
EXPOSE 3001
CMD ["node", "services/ingestion-service/dist/index.js"]
