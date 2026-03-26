# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app

# 只安裝 server workspace 依賴（利用 monorepo root lockfile）
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=development

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY apps/server ./apps/server

WORKDIR /app/apps/server
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/server/package.json ./package.json
# monorepo workspaces 依賴通常 hoist 在 root node_modules
COPY --from=deps /app/node_modules ./node_modules

EXPOSE 9004
ENV PORT=9004

CMD ["node", "dist/main"]

