FROM node:25-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json ./
RUN pnpm install

FROM node:25-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json tsconfig.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
RUN pnpm run build

FROM node:25-bookworm-slim AS runner
WORKDIR /app
RUN corepack enable && \
    apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=4001
COPY package.json ./
RUN pnpm install --prod
COPY --from=build /app/dist ./dist
EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
	CMD curl -f http://localhost:4001/health || exit 1
CMD ["node", "dist/server.js"]
