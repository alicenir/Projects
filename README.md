# Tesla Wrap Studio

A small web app for designing AI-generated custom wraps for your Tesla, sized to match
the upload spec from [teslamotors/custom-wraps](https://github.com/teslamotors/custom-wraps).

Not affiliated with or endorsed by Tesla, Inc.

## What it does

1. Pick your Tesla model (Cybertruck, Model 3, Model Y / Y L, Model S, Model X).
2. Tell it your car's factory paint color — every generated wrap is prompted to
   harmonize with that color instead of clashing with it.
3. Pick a wrap theme (Gaming, Movies, TV Shows, Anime & Comics, Motorsport, Nature &
   Abstract, or a fully custom description) and how bold the coverage should be.
4. Generate artwork per body panel using Google's Gemini image models.
5. Download each result as a spec-compliant PNG (square, 512–1024px, ≤1MB).

Two rules are enforced in code, not just by asking nicely in the prompt:

- **The roof is never generated.** It's a disabled panel in the UI and the app never
  calls the image API for it — the panoramic glass roof has no physical surface to
  wrap, so it always stays empty.
- **The frunk/hood panel always gets a "face the front" instruction** baked into its
  prompt, so its artwork is composed to point toward the nose of the car rather than
  sideways or backward.

Every other panel's factory-color binding and orientation guidance lives in
[`src/lib/promptBuilder.ts`](src/lib/promptBuilder.ts).

## Why Gemini, not Claude

Claude's API doesn't generate images (text and vision-input only), so this app calls
Gemini's image-generation models (the `gemini-*-image` family, aka "Nano Banana")
directly from the browser.

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
