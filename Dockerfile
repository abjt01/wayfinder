# syntax=docker/dockerfile:1

###############################################################################
# deps — install production + build dependencies against the lockfile only
###############################################################################
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

###############################################################################
# builder — compile the Next.js standalone bundle
###############################################################################
FROM node:22-alpine AS builder
WORKDIR /app
# Turns on next.config.mjs's standalone output, which the runner stage copies.
# Builds outside Docker leave it unset so managed hosts package normally.
ENV NEXT_TELEMETRY_DISABLED=1 \
    BUILD_STANDALONE=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The build is fully static/offline: no API key is baked in, and every AI call
# happens at request time, so this stage needs no secrets.
RUN npm run build

###############################################################################
# runner — minimal image, non-root, standalone server only
###############################################################################
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# public/ always exists in the repo (robots.txt); copied before the
# unprivileged files so static assets stay root-owned and read-only.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=4s --start-period=8s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
