# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Watchfloor image.
#
# Three useful targets:
#   runner  - the slim Next.js standalone server (default, what you deploy)
#   tools   - full dependency tree with the Prisma CLI and tsx, used for
#             schema pushes and one-off scripts
#   builder - intermediate; not intended to be run
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# postinstall runs `prisma generate`, which needs the schema present.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time placeholder only; the real value is supplied at runtime.
ENV DATABASE_URL="file:./build.db"
RUN npx prisma generate && npx next build

# Schema pushes and maintenance scripts. Keeps the Prisma CLI and tsx, which
# the standalone runtime deliberately omits.
FROM builder AS tools
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["npx", "prisma", "db", "push", "--skip-generate"]

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Bind all interfaces so the dashboard is reachable from the LAN, not just
# from inside the container.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL="file:/app/data/watchfloor.db"

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Authored briefs are read from disk at runtime.
COPY --from=builder /app/content ./content

# The bundled server runs as an unprivileged user; the data volume is owned by
# it so SQLite can write.
RUN groupadd --system --gid 1001 watchfloor \
    && useradd --system --uid 1001 --gid watchfloor watchfloor \
    && mkdir -p /app/data \
    && chown -R watchfloor:watchfloor /app/data
USER watchfloor

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
