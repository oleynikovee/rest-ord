# syntax=docker/dockerfile:1

FROM node:24-alpine AS shared
WORKDIR /build/shared
COPY shared/package.json shared/package-lock.json shared/tsconfig.json ./
COPY shared/src ./src
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS client
COPY --from=shared /build/shared /build/shared
WORKDIR /build/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

FROM node:24-alpine AS server
COPY --from=shared /build/shared /build/shared
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# --- API image -------------------------------------------------------------
FROM node:24-alpine AS app
ENV NODE_ENV=production \
    PORT=3000 \
    CLIENT_DIST=/app/public
WORKDIR /app
COPY --from=shared /build/shared /shared
COPY --from=server /build/server/package.json ./
COPY --from=server /build/server/node_modules ./node_modules
COPY --from=server /build/server/dist ./dist
COPY --from=client /build/client/dist/client/browser ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "--import", "./dist/instrument.js", "dist/main.js"]

# --- Edge image: static files, TLS, HTTP/2-3 and load balancing ----------------
FROM caddy:2.8-alpine AS edge
COPY edge/Caddyfile /etc/caddy/Caddyfile
COPY --from=client /build/client/dist/client/browser /srv

