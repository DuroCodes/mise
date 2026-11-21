FROM oven/bun:1.4.0
USER root
WORKDIR /app

# yt-dlp + ffmpeg + tesseract: reel speech, and OCR for on-screen ingredient text
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg tesseract-ocr \
    && curl -fsSL -o /usr/local/bin/yt-dlp \
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux" \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

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
