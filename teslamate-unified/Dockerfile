# --- Build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# --- Runtime ---
# No backend of its own: nginx serves the static build and proxies /api to
# TESLAMATE_API_URL (see nginx.conf.template), attaching the bearer token
# server-side so it never ships inside the browser bundle.
FROM nginx:1.27-alpine AS runtime

# nginx:alpine's busybox wget behaves inconsistently across image variants
# for healthchecks (some builds omit it or handle -q/-O differently), so
# curl is installed explicitly rather than assumed present.
RUN apk add --no-cache curl

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

ENV TESLAMATE_API_URL=http://192.168.50.8:8080 \
    API_TOKEN=

EXPOSE 80

# Checks nginx's own static-file serving only — deliberately not the /api
# proxy, so the container isn't marked unhealthy just because TeslaMateApi
# is temporarily unreachable on the LAN.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost/ -o /dev/null || exit 1
