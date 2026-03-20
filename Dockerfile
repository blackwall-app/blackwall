FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./
COPY patches/ ./patches/
COPY packages/blackwall/package.json ./packages/blackwall/
COPY packages/backend/package.json ./packages/backend/
COPY packages/database/package.json ./packages/database/
COPY packages/email/package.json ./packages/email/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/queue/package.json ./packages/queue/
COPY packages/shared/package.json ./packages/shared/

RUN bun install

COPY packages/ ./packages/

RUN bun run build


FROM oven/bun:1-slim AS runtime

WORKDIR /app

COPY --from=builder /app/packages/blackwall/dist/blackwall ./blackwall
COPY --from=builder /app/packages/blackwall/dist/public ./public
COPY --from=builder /app/packages/blackwall/dist/migrations ./migrations
COPY entrypoint.sh ./entrypoint.sh

ENV NODE_ENV=production

RUN mkdir -p blackwall_data && chmod +x ./entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["./blackwall", "serve", "--port", "8000", "--public-dir", "./public"]
