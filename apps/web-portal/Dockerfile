FROM node:20-alpine AS builder
RUN npm install -g pnpm@9.15.0
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/web-portal/package.json ./apps/web-portal/
RUN pnpm install --frozen-lockfile
COPY packages/shared-types ./packages/shared-types
COPY apps/web-portal ./apps/web-portal
RUN pnpm --filter @dvc/shared-types build
RUN pnpm --filter @dvc/web-portal build

FROM nginx:1.27-alpine
COPY --from=builder /app/apps/web-portal/dist /usr/share/nginx/html
COPY apps/web-portal/nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
