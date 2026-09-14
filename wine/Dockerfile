# ---- build ----------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY server/package*.json server/
RUN cd server && npm ci
COPY client/package*.json client/
RUN cd client && npm ci

COPY server server
COPY client client
RUN cd server && npm run build
RUN cd client && npm run build

# prune the server down to production dependencies
RUN cd server && npm prune --omit=dev

# ---- runtime --------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=5100 DATA_DIR=/data

COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/node_modules server/node_modules
COPY --from=build /app/server/package.json server/package.json
COPY --from=build /app/client/dist client/dist
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

ENV CLIENT_DIST=/app/client/dist
VOLUME ["/data"]
EXPOSE 5100
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
