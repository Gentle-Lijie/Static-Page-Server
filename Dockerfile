FROM node:lts-alpine AS base

# Use corepack to activate pnpm; avoid npm -g install to prevent pnpx EEXIST in base image
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories \
    && corepack enable \
    && corepack prepare pnpm@latest --activate \
    && apk add --no-cache git rsync docker-cli docker-cli-compose

# Set pnpm registry to domestic mirror
ENV PNPM_REGISTRY=https://registry.npmmirror.com
RUN pnpm config set registry https://registry.npmmirror.com

WORKDIR /workspace

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS upload
COPY . .
ENV NODE_ENV=production
ENV CI=true
RUN pnpm install --frozen-lockfile --prod
EXPOSE 8787
CMD ["node", "./scripts/upload-server.mjs"]
