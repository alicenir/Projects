# Homebase

A self-hosted startpage / dashboard, in the spirit of [Flame](https://hub.docker.com/r/pawelmalak/flame), with a
modern UI, live SABnzbd downloads, and a Sonarr/Radarr "recently added" media row built in.

## Features

- **App launcher & bookmarks** — pinned app icons up top, categorized bookmarks below. Drag-and-drop
  reordering, inline add/edit/delete in "Edit" mode.
- **Command palette** — press `⌘K` / `Ctrl+K` to fuzzy-search and launch any app instantly.
- **Web search fallback** — type in the search bar and hit Enter to fall back to your configured search
  engine when nothing local matches.
- **Recently added media** — posters, titles and descriptions for the latest movies and episodes
  imported by Radarr/Sonarr, so you can see what landed without opening either app. Click a poster
  for the full synopsis; for TV that's the *episode's* own title and overview (e.g. "Severance ·
  S02E05 — Trojan's Horse"), not just the series blurb.
- **Live SABnzbd widget** — real-time queue with per-item progress bars, speed, ETA, and pause/resume/remove
  controls, pushed to the browser over WebSockets (no page refresh, no polling on the client).
- **Theming** — dark/light mode and a configurable accent color.
- **Optional password lock** — editing (adding/removing apps, changing settings) can be locked behind a
  password; browsing the dashboard itself is always open.
- **Single container** — the backend serves the built frontend, so the whole thing is one image with one
  data volume.

## Architecture

```
client/   React + TypeScript + Vite + Tailwind (the dashboard UI)
server/   Express + TypeScript + SQLite (better-sqlite3) + Socket.IO
```

The server exposes a REST API under `/api`, a WebSocket channel for live SABnzbd queue updates, and (in
production) serves the built client as static files — so the whole app runs as a single container on a
single port.

Sonarr/Radarr metadata comes from your own instances — they already cache overviews and artwork
from TMDB/TheTVDB when they add media, so no third-party API key is needed. Cover art is proxied
through the backend (`/api/media/cover/...`), so the browser never sees an API key and doesn't need
internet access of its own; only `/MediaCover/` paths are proxied, so the endpoint can't be used as
a general request forwarder. Recently-added data is cached server-side for 60s and refreshed by the
client every 5 minutes.

SABnzbd credentials are stored server-side only; the browser never sees your API key. The server polls
SABnzbd's JSON API (`/api?mode=queue` / `mode=history`) on an adaptive interval — every 2s while something
is actively downloading, every 8s when idle — and broadcasts snapshots to all connected clients over
Socket.IO.

## Running locally (development)

```bash
# terminal 1
cd server
cp .env.example .env
npm install
npm run dev        # http://localhost:5000

# terminal 2
cd client
npm install
npm run dev         # http://localhost:5173 (proxies /api and /socket.io to :5000)
```

## Running with Docker Compose

```bash
docker compose up -d --build
```

The app will be available at `http://<host>:5000`. Data (SQLite DB) persists in the `homebase_data` named
volume.

## Deploying via Portainer

1. In Portainer, go to **Stacks → Add stack**.
2. Choose **Repository** and point it at this repo (or paste the contents of `docker-compose.yml` under
   **Web editor**).
3. Before deploying, set a real `JWT_SECRET` value (used to sign edit-mode login sessions) — either edit
   the environment variable in the stack editor, or add it under **Environment variables** in the Portainer
   UI.
4. Deploy the stack. Portainer will build the image from the included `Dockerfile` and start the
   `homebase` container with a persistent `homebase_data` volume.
5. Open `http://<host>:5000`, go to **Settings → Downloads**, and enter your SABnzbd URL + API key (found
   in SABnzbd under **Config → General**).
6. Optionally connect Sonarr and Radarr under **Settings → Media** (API key is in each app under
   *Settings → General*) to get the "Recently added" poster row.
7. Optionally set a password under **Settings → Security** to lock editing.

## Configuration reference

| Env var       | Default             | Purpose                                              |
| ------------- | -------------------- | ----------------------------------------------------- |
| `PORT`        | `5000`               | Port the server listens on                            |
| `DATA_DIR`    | `/data`               | Where the SQLite database is stored                   |
| `JWT_SECRET`  | *(insecure default)* | Secret used to sign edit-mode login tokens — set this! |
| `CORS_ORIGIN` | *(same-origin)*      | Only needed if you split client/server across origins |

All other configuration (SABnzbd/Sonarr/Radarr connections, theme, greeting, search engine, password) lives in the
database and is managed from the in-app **Settings** panel — nothing else needs to be set via environment
variables or config files.

## Roadmap / ideas to make it even more awesome

The SABnzbd widget is built on a small, self-contained service module
(`server/src/services/sabnzbd.ts`) specifically so more *arr-stack integrations can be added the same way
without touching the rest of the app. Natural next steps:

- **More live widgets**: qBittorrent/Transmission (torrent queue alongside the Usenet one),
  Plex/Jellyfin (now playing), Overseerr/Ombi (pending requests), Uptime Kuma (service health dots on
  each app card), and an *upcoming* calendar from Sonarr to sit alongside "Recently added".
- **Host stats widget**: CPU/RAM/disk/network via a tiny agent, shown as sparklines in the sidebar.
- **Per-app health check**: ping each app's URL and show a green/red dot on its icon, so you know at a
  glance what's down.
- **Multi-user profiles**: separate dashboards/layouts per household member, each with their own pinned
  apps.
- **Notifications**: desktop/browser push when a SABnzbd job completes or fails, or a monitored service
  goes down.
- **Import/export**: JSON export of the whole layout (apps, bookmarks, categories, settings) for backup or
  syncing between instances.
- **Custom CSS / widget layout editor**: drag widgets (not just app icons) around a grid, resize them,
  toggle visibility.
- **Reverse-proxy awareness**: auto-detect internal vs. external URLs (LAN IP vs. domain) and pick the
  right one depending on where the browser is connecting from — a genuinely nice Flame-beating feature.

The rest are not implemented yet, but the codebase is structured (typed REST API, a settings table for
arbitrary config, a Socket.IO channel already wired up) so each one is an incremental addition rather than
a rewrite.
