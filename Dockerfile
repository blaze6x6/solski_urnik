# ---------------------------------------------------------------------------
# Zasebni šolski urnik — produkcijska slika (Next.js standalone)
# ---------------------------------------------------------------------------

FROM node:20-alpine AS deps
WORKDIR /app
# package-lock.json je priporocen (npm ci), a ni nujen — sicer fallback na npm install
COPY package.json package-lock*.json ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# zagotovi, da mapi obstajata tudi, ce ju ni v kopiji projekta (npr. prazen public/)
RUN mkdir -p /app/public /app/drizzle
# PWA ikone: ce obstaja public/icons/icon-master.png, iz njega ustvari vse velikosti
RUN if [ -f public/icons/icon-master.png ]; then \
      npm install --no-save --no-audit --no-fund sharp && node scripts/generate-icons.mjs; \
    fi
# DATABASE_URL je ob gradnji le symbolicen; dejanski pride ob zagonu vsebnika
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_db
ENV DATABASE_URL=$DATABASE_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache tzdata
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Europe/Ljubljana \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
