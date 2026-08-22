# TeslaMate Unified

A single-page, self-hosted dashboard that replaces TeslaMate's stock Grafana dashboards with one
cohesive, colorful interface. All data comes from [TeslaMateApi](https://github.com/tobiasehlert/teslamateapi) —
Grafana is not used at all.

![screenshot placeholder](docs/screenshot.png)

## Architecture

- **React + TypeScript + Vite**, Tailwind CSS, hand-authored shadcn-style primitives, TanStack
  Query, Recharts, MapLibre GL (OpenFreeMap tiles — no API key), Framer Motion, date-fns, Zustand-free
  (React state was enough at this scale; TanStack Query owns all server state).
- **No backend of its own.** The browser only ever calls same-origin `/api/...`. In development,
  Vite's dev server proxies that to `TESLAMATE_API_URL` (see `vite.config.ts`); in the built image,
  nginx does the same (`nginx.conf.template`). Either way, the bearer token is attached server-side
  and never ships inside browser JS.
- **Typed API client** (`src/api/client.ts` + `src/api/schemas.ts`): every TeslaMateApi response is
  validated with Zod. The schemas were checked against TeslaMateApi's actual Go source, not just its
  (admittedly incomplete) docs — including two real quirks worth knowing about if you extend this:
  handler-level failures respond `HTTP 200` with `{"error": "..."}` instead of a 4xx, and empty list
  endpoints (`drives`, `charges`, `updates`) serialize as `null`, not `[]`, because of how Go marshals
  a nil slice. Both are handled centrally in the client.

## Known scope trims

- **Per-row route thumbnails** on the drives list were skipped — TeslaMateApi's own guidance is not
  to fetch geodata on list calls, and a thumbnail per row would mean a drive-detail request per
  visible row. Rows show a stat strip instead; click through to the detail drawer for the actual
  route map.
- **The full map view's route overlay is capped** to the 15 most recent drives in the selected
  range, for the same reason — each route is its own detail fetch.
- **MQTT live updates were designed for but not implemented.** The status polling backs off
  adaptively by vehicle state (10s driving/charging, 30s online, 60s asleep/offline — see
  `src/api/hooks.ts`'s `useCarStatus`), which covers the "live enough" requirement without needing a
  broker exposed over WebSockets to the browser. Subscribing directly to Mosquitto from the client is
  a reasonable follow-up if you want sub-poll-interval latency.
- **Battery health is deliberately all-time**, ignoring the top date-range picker — a degradation
  trend over a 30-day window is flat and not useful. This is called out in the section's own header,
  not just here.
- Efficiency-vs-temperature and cost/leaderboard views aggregate the *full* selected period via a
  capped, paged fetch (20 pages × 100 records) rather than a single unbounded request, since
  TeslaMateApi has no aggregate endpoint of its own.

## Environment variables

| Var | Default | Purpose |
| --- | --- | --- |
| `TESLAMATE_API_URL` | `http://192.168.50.8:8080` | Base URL of your TeslaMateApi instance. No trailing slash, no `/api` suffix. |
| `API_TOKEN` | *(empty)* | Bearer token for TeslaMateApi. Leave blank if it has `API_TOKEN_DISABLE=true`. |
| `API_TOKEN_DISABLE` | `false` | **Dev server only** (`vite.config.ts`). Set `true` to skip attaching the `Authorization` header entirely, matching TeslaMateApi's own flag. In the built image, an empty `API_TOKEN` has the same effect. |

Copy `.env.example` to `.env` for local development.

## Running locally

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api to TESLAMATE_API_URL
```

## Deploying with Docker

```bash
docker compose up -d --build
```

The app is a single stateless container — no database, no volumes, nothing to back up. Everything
comes from TeslaMateApi on every request. Point `TESLAMATE_API_URL` at your instance (and set
`API_TOKEN` if it requires one), and it can sit on the same Docker network as your existing TeslaMate
stack or reach it over the LAN.

## Deploying via Portainer

1. In Portainer, go to **Stacks → Add stack**, and choose **Repository** as the build method.
2. Fill in the Git repository fields:
   - **Repository URL**: `https://github.com/alicenir/Projects`
   - **Repository reference**: `refs/heads/claude/teslamate-unified-project-z82b8e` while this is
     still on its feature branch, or `refs/heads/main` once it's merged (either works — Portainer
     needs the full `refs/heads/<branch>` form, not just the branch name).
   - **Compose path**: `teslamate-unified/docker-compose.yml` — this repo has more than one app in
     it, so the compose file isn't at the repo root.

   (Alternatively, skip the repo link entirely: pick **Web editor** and paste in the contents of
   `teslamate-unified/docker-compose.yml` directly.)
3. Under **Environment variables**, set:
   - `TESLAMATE_API_URL` — your TeslaMateApi URL, e.g. `http://192.168.50.8:8080` (no trailing
     slash, no `/api` suffix). If TeslaMateApi runs as another container on the same Docker
     network, you can use its container/service name instead of an IP.
   - `API_TOKEN` — the bearer token from TeslaMateApi's own `.env` (its `API_TOKEN` value). Leave
     it blank if that instance has `API_TOKEN_DISABLE=true`.
4. Deploy the stack. Portainer builds the image from the included `Dockerfile` (multi-stage: Node
   build → nginx serve) and starts the `teslamate-unified` container.
5. Open `http://<host>:8090`. There's no login, no settings panel, and nothing to configure in the
   app itself — everything comes from the two environment variables above. Change the host port by
   editing the `ports` mapping in the stack (`"8090:80"`) if 8090 is already taken on your NAS.
6. If the map tiles or the dashboard data don't load, check the container's logs in Portainer first
   — nginx logs both its own errors and proxy failures to `/api`, which is the fastest way to tell
   a bad `TESLAMATE_API_URL`/`API_TOKEN` apart from TeslaMateApi itself being down.

## Type checking & building

```bash
npm run typecheck
npm run build
```
