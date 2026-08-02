# Tesla Wrap Studio

A web app for designing AI-generated custom wraps for your Tesla, built directly on
top of the official templates and vehicle list from
[teslamotors/custom-wraps](https://github.com/teslamotors/custom-wraps).

Not affiliated with or endorsed by Tesla, Inc.

## What it does

1. **Pick your exact Tesla** from the same 12 vehicles/trims listed in the
   teslamotors/custom-wraps README (Cybertruck, Model 3, Model 3 (2024+) Standard &
   Premium / Performance, Model Y, Model Y (2025+) Standard / Premium / Performance,
   Model Y L, Model S (2021+), Model S (2025+) Plaid, Model X (2021+)) — names and
   thumbnails are fetched live from that repo, so they always match.
2. **Tell it your factory paint color**, including Glacier Blue, Frost Blue, Marine
   Blue, Deep Blue Metallic, Pearl White Multi-Coat, Solid Black, Diamond Black,
   Stealth Grey, Quicksilver, Ultra Red, or a custom color — every generated wrap is
   prompted to harmonize with it instead of clashing.
3. **Describe the wrap you want** in a long-form prompt box (up to 4000 characters),
   with one-click category chips (Gaming, Movies, TV Shows, Anime & Comics, Motorsport,
   Nature & Abstract) and franchise examples to jump-start ideas, plus a coverage
   intensity control (subtle / balanced / bold).
4. **Generate Wrap** uses your description as-is. **✨ AI Wrap Generation** invents a
   full creative concept for you (optionally steered by whatever you've already typed)
   and generates it immediately — for when you just want something great without
   writing the brief yourself.
5. **Preview window** shows Tesla's official blank template next to your generated
   result, and lets you download it as a spec-compliant PNG.

## How generation actually works

Rather than generating a wrap from scratch, the app downloads the **real
`template.png`** for your selected vehicle straight from teslamotors/custom-wraps and
sends it to Gemini as an input image alongside your text prompt, asking it to fill in
the existing panel outlines — the same way you'd edit the template by hand. See
[`src/lib/promptBuilder.ts`](src/lib/promptBuilder.ts) and
[`src/lib/gemini.ts`](src/lib/gemini.ts).

This makes two of the trickier requirements structural instead of just prompted:

- **The roof can never get an image or background.** Tesla's own templates don't
  include a roof region at all — their in-car visualizer always renders the glass roof
  on top of whatever wrap is applied, regardless of the template contents. Since
  generation is bounded to the real template's outlines, there's no roof-shaped area
  for anything to be drawn into in the first place.
- **The frunk/hood panel is always instructed to face front.** The template's
  hood/frunk region (the shield-shaped panel with two headlight cutouts) gets an
  explicit directive to compose artwork pointing toward the front of the car — this
  part is still prompt-based, since it lives inside a single generated image rather
  than being a separate structural panel.

## Why Gemini, not Claude

Claude's API doesn't generate images (text and vision-input only), so this app calls
Gemini's image models directly from the browser: an image-editing model (the
`gemini-*-image` family, aka "Nano Banana") for the wrap itself, and a fast text model
for inventing concepts when you use "AI Wrap Generation" with an empty prompt.

## Running it locally

```bash
npm install
npm run dev
```

Then open the printed local URL. You'll need a free Gemini API key from
[aistudio.google.com/apikey](https://aistudio.google.com/apikey) — paste it into the
"Connect your Gemini API key" box. The key is stored only in your browser's
`localStorage` and is sent directly to Google's API; this project has no backend and
never sees or stores your key.

**Heads up:** because API calls go straight from the browser, your key is visible in
that browser's network requests. That's fine for local/personal use, but don't deploy
a build of this app publicly with a key embedded or shared.

## Build

```bash
npm run build
```

Type-checks with `tsc` and produces a static `dist/` bundle via Vite — deployable to
any static host, as long as you keep the API-key caveat above in mind.

## Running with Docker

If you'd rather not install Node at all:

```bash
docker compose up -d --build
```

Then open `http://localhost:8095`.

The host port is configurable without editing `docker-compose.yml` — copy
`.env.example` to `.env` and set `WRAP_PORT`, or pass it inline:

```bash
WRAP_PORT=9137 docker compose up -d --build
```

Two-stage build: `node:22-alpine` compiles the bundle, then the runtime image installs
production dependencies only (no Vite, no TypeScript) and runs a small Express server
to serve the built app. Both stages are multi-arch, so this works on x86 and ARM alike
— most NAS hardware, Raspberry Pi, Apple Silicon.

No build-time configuration or secrets are needed. Your Gemini key is entered in the
browser at runtime and stored in that browser's `localStorage`; it is never sent to,
proxied by, or stored on the server.

### Deploying on a NAS with Portainer

1. In Portainer, go to **Stacks → Add stack**, name it `tesla-wrap-studio`, and choose
   **Repository** as the build method.
2. **Repository URL**: `https://github.com/<your-user>/<your-repo>`
3. **Repository reference**: `refs/heads/<your-branch>` — Portainer wants the full ref,
   not just the branch name.
4. **Compose path**: `docker-compose.yml`
5. If the repository is private, switch on **Authentication** and use your GitHub
   username with a [personal access token](https://github.com/settings/tokens) (scope
   `repo`) as the password. A normal account password will not work.
6. Optionally set `WRAP_PORT` in the **Environment variables** box to any free port
   (defaults to `8095`) — no file editing needed.
7. Click **Deploy the stack**. The first deploy compiles the bundle, so expect a few
   minutes on slower NAS hardware; later deploys reuse cached layers.

The app is then reachable at `http://<nas-ip>:<WRAP_PORT>`. Note that's your NAS's own
IP — not the container IP Portainer shows in its container list, which is on Docker's
internal network and unreachable from the rest of your LAN.

If the deploy fails with a port-allocation error, that port is already in use — pick
another and redeploy. To see what's taken, SSH into the NAS and run
`netstat -tuln | grep LISTEN` (or `docker ps` to check other containers).

To pick up later changes, open the stack in Portainer and use **Pull and redeploy**.

If saving fails with a permissions error, the container (running as root by default)
can't write to that share — check the share's permissions, or add a `user:` mapping to
the service matching the owner of the folder.

### Running the server without Docker

```bash
npm run start          # builds, then serves on http://localhost:3000
```

Or during development, with hot reload, run the API and the Vite dev server together:

```bash
npm run server         # terminal 1 — API on :3000
npm run dev            # terminal 2 — UI on :5173, proxies /api to :3000
```

Set `PORT` to change the listening port (defaults to `3000`).
