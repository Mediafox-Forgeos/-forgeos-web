FROM node:20-alpine AS base
RUN npm i -g pnpm

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/movos-api/package.json apps/movos-api/
RUN pnpm install --frozen-lockfile --filter @mediafox/movos-api...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/movos-api/node_modules ./apps/movos-api/node_modules
COPY packages/ packages/
COPY apps/movos-api/ apps/movos-api/
WORKDIR /app/apps/movos-api
RUN pnpm prisma generate
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
RUN npm i -g pnpm
COPY --from=builder /app/apps/movos-api/dist dist/
COPY --from=builder /app/apps/movos-api/prisma prisma/
COPY --from=builder /app/apps/movos-api/package.json .
RUN pnpm install --prod
RUN pnpm prisma generate
EXPOSE 4000
CMD ["node", "dist/main"]
