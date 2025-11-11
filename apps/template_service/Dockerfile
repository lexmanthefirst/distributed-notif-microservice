FROM node:25-bookworm-slim AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

FROM node:25-bookworm-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml* tsconfig.json tsconfig.build.json nest-cli.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
RUN pnpm run build

FROM node:25-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=4002
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
EXPOSE 4002
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
	CMD curl -f http://localhost:4002/health || exit 1
CMD ["node", "dist/main.js"]
