# --- Build client ---
FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
RUN npm run build

# --- Build server ---
FROM node:22-alpine AS server-build
WORKDIR /app/server
RUN apk add --no-cache python3 make g++
COPY server/package.json server/package-lock.json* ./
RUN npm install
COPY server/ ./
RUN npm run build

# --- Runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache python3 make g++ && \
    addgroup -S homebase && adduser -S homebase -G homebase

COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev && \
    apk del python3 make g++

COPY --from=server-build /app/server/dist ./dist
COPY --from=client-build /app/client/dist ./public

ENV NODE_ENV=production \
    PORT=5000 \
    DATA_DIR=/data \
    CLIENT_DIST=/app/public

RUN mkdir -p /data && chown -R homebase:homebase /data /app
USER homebase

EXPOSE 5000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
