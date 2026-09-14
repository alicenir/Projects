# Terroir

A wine site for people who actually drink wine, built entirely on open data. It ingests two public
datasets, derives the analytics itself, and serves a browsable atlas: 1,007 wines, 150,000 drinker
ratings, 130,000 critic tasting notes, grapes, regions, food pairings, price benchmarks — plus a
cellar and tasting journal of your own.

```
┌──────────────┐   ingest    ┌────────────┐   REST    ┌────────────┐
│ open CSV     │ ─────────▶  │  SQLite    │ ────────▶ │ React SPA  │
│ datasets     │  download,  │  catalogue │  /api     │ (Vite/TS)  │
└──────────────┘  parse,     │  + FTS5    │           └────────────┘
                  aggregate  └────────────┘
```

## Where the data comes from

| Source | What it gives us | Licence |
| --- | --- | --- |
| [X-Wines](https://github.com/rogerioxavier/X-Wines) — Slim edition | 1,007 wines with grapes, food pairings, body, acidity, ABV, vintages, regions and producers, plus 150,000 real 1–5 star ratings from 10,561 tasters (2012–2021) | CC BY 4.0 (the repo also carries a CC0 dedication) — cite the [paper](https://www.mdpi.com/2504-2289/7/1/20) in published work |
| Wine Enthusiast tasting notes, served from the [TidyTuesday archive](https://github.com/rfordatascience/tidytuesday/tree/master/data/2019/2019-05-28) | 129,971 critic reviews: 80–100 point scores, bottle prices and a paragraph of tasting notes | Scraped from WineEnthusiast in 2017 and published on Kaggle; non-commercial use, attribution kept in the footer |

Nothing is scraped live from a site that does not want to be scraped: the ingester downloads
published CSV files over HTTPS, caches them, and builds a local database.

The full 100,646-wine / 21M-rating X-Wines edition is only distributed through Google Drive and
Kaggle, so it cannot be fetched by script. Download it by hand and point the ingester at the files
(see below) — everything in the app scales to it.

## Quick start

```bash
# 1. build the catalogue (downloads ~60 MB once, takes about a minute)
cd server
npm install
npm run ingest

# 2. run the API
npm run dev            # http://localhost:5100

# 3. run the UI in another terminal
cd ../client
npm install
npm run dev            # http://localhost:5173, proxies /api to the server
```

Or in one container:

```bash
docker compose up --build     # http://localhost:5100
```

The container builds the catalogue on first boot into its `/data` volume. Set `AUTO_INGEST=0` to
skip that, or `EDITION=test` for a 100-wine smoke build.

### Ingest options

```bash
npm run ingest                      # X-Wines Slim + critic reviews (the default)
npm run ingest -- --edition test    # 100 wines, 1K ratings — fast smoke build
npm run ingest -- --no-critics      # skip the 53 MB review file
npm run ingest -- --refresh         # re-download instead of using the cache
npm run ingest -- --edition full \
  --wines ~/Downloads/XWines_Full_100K_wines.csv \
  --ratings ~/Downloads/XWines_Full_21M_ratings.csv
```

Each run writes a fresh `data/wine.db` (catalogue, disposable) and leaves `data/cellar.db` (your
bottles, notes and wishlist) untouched. The two are attached to one connection, so a query can join
your shelf to its wine.

## What it does with the data

**Search and browse.** SQLite FTS5 over name, producer, region, country, grapes and food tags, with
prefix matching so results narrow as you type. Facet counts (style, country, grape, pairing, body,
acidity) are recomputed under the filters you already applied.

**Honest rankings.** Every average is shrunk towards the global mean by 25 notional votes, so a wine
with one five-star rating does not outrank Château Lafite. The raw average and the count are always
shown next to the weighted score.

**Two recommenders, both explainable.**
- *Same style, different bottle* — cosine similarity over weighted content features (grapes count
  most, then style, then origin and pairings), with candidates drawn from an inverted index so it
  stays tractable on the 100K edition.
- *Drinkers who loved this also loved* — item-item cosine over mean-centred user ratings. Prolific
  users are capped so one power taster cannot dominate, and pairs seen by few shared raters are
  damped rather than trusted.

**Flavour, counted.** 130K tasting notes are tokenised against a curated vocabulary of ~150 aroma,
structure and oak descriptors grouped into families. Each grape and country gets a *lift* score —
how much more often a word appears here than across all reviews — which is what makes "Pinot Noir →
cranberry, pomegranate, silky, mushroom" fall out of the data rather than out of a wine textbook.

**Prices with a reference point.** Critic scores and prices are matched to the catalogue by
normalised grape name ("Syrah/Shiraz" → Shiraz, "Tinta Roriz" → Tempranillo) and ISO country code,
so a wine page can say what its grape usually costs and how it usually scores.

**Your cellar.** Bottles with vintage, price paid, location and a drink-by window; a tasting journal
with your own scores; a wishlist; CSV export. Recommendations switch from your quiz answers to your
actual shelf as soon as there is something on it.

**Games and entry points.** A blind-tasting game deals a real critic note with the grape, country
and region scrubbed out and asks you to name it. A six-question taste test builds a profile and
returns a dozen bottles, each with the reason it was picked.

## API

All endpoints are under `/api`.

| Endpoint | What it returns |
| --- | --- |
| `GET /health` | catalogue status and build metadata |
| `GET /wines` | filtered, sorted, paginated list + facet counts |
| `GET /wines/:id` | one wine: histogram, rating timeline, per-vintage scores, neighbours, critic benchmark, flavour profile, your cellar state |
| `GET /wines/random`, `GET /suggest` | surprise pick; type-ahead |
| `GET /analytics/{summary,ratings,styles,geography,grapes,market,flavours}` | dashboard panels |
| `GET /grapes`, `/grapes/:name` | grape encyclopedia |
| `GET /countries`, `/countries/:code`, `/regions/:id`, `/wineries/:id` | atlas |
| `GET /pairings`, `/pairings/:name` | food pairings |
| `POST /recommend`, `GET /recommend/for-me` | taste-profile and cellar-based recommendations |
| `GET /discover/tonight`, `/discover/flight`, `/game/blind` | discovery and the tasting game |
| `GET/POST/PATCH/DELETE /cellar`, `/notes`, `/wishlist`, `/profile` | your own data, plus `/cellar/export.csv` |

## Chart colours

Series colours are not chosen by eye. The wine-type palette — red, port, dessert, sparkling, white,
rosé — is in that specific order because it is the ordering that clears the colour-blind separation
gates (adjacent ΔE ≥ 8, normal-vision ΔE ≥ 15) in **both** light and dark themes; re-ordering it
breaks the guarantee. Tokens live in `client/src/index.css`, every chart carries a table view, and
the sequential ramp is redefined for the dark surface rather than flipped.

## Layout

```
server/
  src/ingest/    download → parse CSV → build SQLite (schema, aggregates, similarity, FTS)
  src/routes/    wines, analytics, reference, discover, cellar
  src/lib/       query builder, grape/country taxonomy, descriptor vocabulary
client/
  src/pages/     home, explore, wine, analytics, grapes, atlas, pairings, taste test, blind tasting, cellar
  src/components/ chart kit (SVG, no chart library) and shared UI
```

## Ideas worth building next

- **A real map.** Region polygons or at least lat/long pins would beat the current ranked lists.
- **Vintage weather.** Growing-degree-days per region and year from an open climate API, plotted
  against the vintage curve, would turn "2010 scored well" into "2010 scored well because…".
- **Drink-window alerts.** The cellar already stores a window; a scheduled job could mail you when a
  bottle enters or leaves its peak.
- **Shared tastings.** Multiple profiles, so a table of friends can each score the same bottle.
- **Label scanning.** OCR a label into a catalogue match; the X-Wines Full edition ships label images.
- **Retail prices.** The critic prices are 2017 US dollars; a live price feed would make the value
  charts actionable rather than historical.
