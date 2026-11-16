FROM oven/bun:1.4.0
USER root
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build \
    && mkdir -p /data/uploads \
    && chown -R bun:bun /app /data

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["bun", "server/index.ts"]
