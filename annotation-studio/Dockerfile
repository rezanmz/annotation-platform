# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ARG LITESTREAM_VERSION=0.5.18
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl util-linux \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL -o /tmp/litestream.tar.gz "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-${LITESTREAM_VERSION}-linux-x86_64.tar.gz" \
 && echo "d3687b9fd0f2e9426bbd3da828429ff3f1dfc5c9b74d54fdf028e4ee510e7dea  /tmp/litestream.tar.gz" | sha256sum -c - \
 && tar -xzf /tmp/litestream.tar.gz -C /usr/local/bin litestream \
 && rm /tmp/litestream.tar.gz \
 && litestream version

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/data/app.db \
    GUIDELINES_DIR=/data/guidelines
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY guidelines ./seed-guidelines
COPY drizzle ./drizzle
COPY scripts ./scripts
COPY lib/server/password.ts ./lib/server/password.ts
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh && useradd --uid 10001 --create-home app && mkdir -p /data && chown -R app:app /data /app
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
