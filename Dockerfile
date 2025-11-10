FROM node:25-bookworm-slim
LABEL org.opencontainers.image.source="https://github.com/your-org/distributed-notifs"
LABEL org.opencontainers.image.description="Dev container for the distributed notification monorepo"

WORKDIR /workspace

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 python3-pip python3-venv git \
	&& rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
RUN pnpm install --ignore-scripts --frozen-lockfile

COPY . .

CMD ["bash"]
