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

If you'd rather not install Node at all, the included `Dockerfile` builds the app and
serves the result with nginx:

```bash
docker compose up -d --build
```

Then open `http://localhost:8088`. Change the left-hand port in `docker-compose.yml`
if 8088 is already in use.

The image is a two-stage build: `node:22-alpine` compiles the bundle, then only the
static output is copied into `nginx:alpine`, so the running container has no Node or
source code in it. Both base images are multi-arch, so this works on x86 and ARM
(including most NAS hardware and Apple Silicon).

Nothing needs to be configured at build time — no environment variables, no secrets,
no API key. The container serves static files only; your Gemini key is entered in the
browser at runtime and stored in that browser's `localStorage`.

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
6. Click **Deploy the stack**. The first deploy compiles the bundle, so expect a few
   minutes on slower NAS hardware; later deploys reuse cached layers.

The app is then reachable at `http://<nas-ip>:8088`. Because everything runs in the
browser and talks to Google directly, the NAS only ever serves static files — it never
sees or proxies your API key.

To pick up later changes, open the stack in Portainer and use **Pull and redeploy**.
