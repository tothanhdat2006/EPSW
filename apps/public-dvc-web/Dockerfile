FROM node:20-alpine AS builder
RUN npm install -g pnpm@9.15.0
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/public-dvc-web/package.json ./apps/public-dvc-web/
RUN pnpm install --frozen-lockfile
COPY packages/shared-types ./packages/shared-types
COPY apps/public-dvc-web ./apps/public-dvc-web
RUN pnpm --filter @dvc/shared-types build
RUN pnpm --filter @dvc/public-dvc-web build

FROM nginx:1.27-alpine
COPY --from=builder /app/apps/public-dvc-web/dist /usr/share/nginx/html
COPY apps/public-dvc-web/nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 3005
