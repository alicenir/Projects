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

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

ENV TESLAMATE_API_URL=http://192.168.50.8:8080 \
    API_TOKEN=

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/ >/dev/null || exit 1
