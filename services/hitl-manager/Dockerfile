FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.0

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/logger/package.json ./packages/logger/
COPY packages/database/package.json ./packages/database/
COPY services/hitl-manager/package.json ./services/hitl-manager/
RUN pnpm install --frozen-lockfile
COPY packages/shared-types ./packages/shared-types
COPY packages/logger ./packages/logger
COPY packages/database ./packages/database
COPY services/hitl-manager ./services/hitl-manager
RUN pnpm --filter @dvc/shared-types build
RUN pnpm --filter @dvc/logger build
RUN pnpm --filter @dvc/database build
RUN pnpm --filter @dvc/hitl-manager build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@9.15.0
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/hitl-manager/dist ./services/hitl-manager/dist
COPY --from=builder /app/services/hitl-manager/package.json ./services/hitl-manager/
RUN pnpm install --prod --frozen-lockfile
EXPOSE 3003
CMD ["node", "services/hitl-manager/dist/index.js"]
