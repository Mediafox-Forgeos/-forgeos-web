# Build context: monorepo root
# Railway uses this file to build the movos-api service

FROM node:22-alpine AS base
RUN npm i -g pnpm@11.5.3

# ── Install all workspace deps (build tools + runtime) ─────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/movos-api/package.json apps/movos-api/
RUN pnpm install --frozen-lockfile --filter @mediafox/movos-api...

# ── Compile TypeScript → JavaScript ────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/movos-api/node_modules ./apps/movos-api/node_modules
COPY packages/ packages/
COPY apps/movos-api/ apps/movos-api/
WORKDIR /app/apps/movos-api
RUN pnpm prisma generate
RUN pnpm build

# ── Runtime image ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
# Copy workspace node_modules (includes prisma CLI for migrate deploy)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/movos-api/node_modules ./apps/movos-api/node_modules
COPY --from=deps /app/packages ./packages
# Override with Prisma client binaries generated for this exact platform
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Application artifacts
COPY --from=builder /app/apps/movos-api/dist ./apps/movos-api/dist
COPY --from=builder /app/apps/movos-api/prisma ./apps/movos-api/prisma
WORKDIR /app/apps/movos-api
EXPOSE 4000
# Run pending migrations then start the API
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main"]
