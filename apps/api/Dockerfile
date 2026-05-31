FROM node:22-bookworm AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --no-frozen-lockfile
COPY apps/api apps/api

RUN pnpm --filter @ai-video/api build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    ffmpeg \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libxss1 \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY --from=build /app /app

EXPOSE 4000

CMD ["pnpm", "--filter", "@ai-video/api", "start"]
