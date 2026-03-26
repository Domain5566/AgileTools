# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=production
ARG NEXT_PUBLIC_WS_ORIGIN
ENV NEXT_PUBLIC_WS_ORIGIN=${NEXT_PUBLIC_WS_ORIGIN}

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web ./apps/web

RUN npm run build -w web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/web ./apps/web

EXPOSE 9003
ENV PORT=9003

CMD ["npm", "run", "start", "-w", "web"]

