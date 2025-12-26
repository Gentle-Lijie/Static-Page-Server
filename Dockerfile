FROM node:lts-alpine AS base

# Use corepack to activate pnpm; avoid npm -g install to prevent pnpx EEXIST in base image
RUN corepack enable \
    && corepack prepare pnpm@latest --activate \
    && apk add --no-cache git rsync

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
