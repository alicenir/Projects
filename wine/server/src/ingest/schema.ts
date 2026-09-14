/** DDL for the catalogue database. Rebuilt from scratch by every ingest run. */
export const CATALOGUE_SCHEMA = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE wines (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT,
  elaborate     TEXT,
  abv           REAL,
  body          TEXT,
  acidity       TEXT,
  country_code  TEXT,
  country       TEXT,
  region_id     INTEGER,
  region        TEXT,
  winery_id     INTEGER,
  winery        TEXT,
  website       TEXT,
  grapes        TEXT NOT NULL DEFAULT '[]',
  pairings      TEXT NOT NULL DEFAULT '[]',
  vintages      TEXT NOT NULL DEFAULT '[]',
  vintage_min   INTEGER,
  vintage_max   INTEGER,
  vintage_count INTEGER DEFAULT 0,
  non_vintage   INTEGER DEFAULT 0,
  rating_count  INTEGER DEFAULT 0,
  rating_avg    REAL,
  rating_score  REAL,
  first_rated   TEXT,
  last_rated    TEXT
);
CREATE INDEX wines_type ON wines(type);
CREATE INDEX wines_country ON wines(country);
CREATE INDEX wines_region ON wines(region_id);
CREATE INDEX wines_winery ON wines(winery_id);
CREATE INDEX wines_score ON wines(rating_score DESC);
CREATE INDEX wines_body ON wines(body);
CREATE INDEX wines_acidity ON wines(acidity);

CREATE TABLE wine_grapes (wine_id INTEGER NOT NULL, grape TEXT NOT NULL, PRIMARY KEY (wine_id, grape));
CREATE INDEX wine_grapes_grape ON wine_grapes(grape);

CREATE TABLE wine_pairings (wine_id INTEGER NOT NULL, pairing TEXT NOT NULL, PRIMARY KEY (wine_id, pairing));
CREATE INDEX wine_pairings_pairing ON wine_pairings(pairing);

CREATE TABLE wine_vintages (wine_id INTEGER NOT NULL, vintage INTEGER NOT NULL, PRIMARY KEY (wine_id, vintage));
CREATE INDEX wine_vintages_vintage ON wine_vintages(vintage);

CREATE TABLE ratings (
  id       INTEGER PRIMARY KEY,
  user_id  INTEGER NOT NULL,
  wine_id  INTEGER NOT NULL,
  vintage  INTEGER,
  rating   REAL NOT NULL,
  rated_at TEXT,
  ym       TEXT,
  year     INTEGER
);
CREATE INDEX ratings_wine ON ratings(wine_id);
CREATE INDEX ratings_user ON ratings(user_id);
CREATE INDEX ratings_ym ON ratings(ym);
CREATE INDEX ratings_vintage ON ratings(vintage);

CREATE TABLE wine_rating_hist (wine_id INTEGER NOT NULL, bucket REAL NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (wine_id, bucket));

CREATE TABLE wine_similar (
  wine_id  INTEGER NOT NULL,
  other_id INTEGER NOT NULL,
  kind     TEXT NOT NULL,          -- 'profile' (content) | 'taste' (collaborative)
  score    REAL NOT NULL,
  PRIMARY KEY (wine_id, kind, other_id)
);
CREATE INDEX wine_similar_lookup ON wine_similar(wine_id, kind, score DESC);

CREATE TABLE grapes (
  name          TEXT PRIMARY KEY,
  wine_count    INTEGER DEFAULT 0,
  varietal_count INTEGER DEFAULT 0,
  rating_count  INTEGER DEFAULT 0,
  rating_avg    REAL,
  abv_avg       REAL,
  top_type      TEXT,
  top_country   TEXT,
  top_body      TEXT,
  top_acidity   TEXT,
  pairings      TEXT NOT NULL DEFAULT '[]',
  blends_with   TEXT NOT NULL DEFAULT '[]',
  countries     TEXT NOT NULL DEFAULT '[]',
  critic_n      INTEGER DEFAULT 0,
  critic_points REAL,
  critic_price  REAL
);

CREATE TABLE countries (
  code          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  wine_count    INTEGER DEFAULT 0,
  region_count  INTEGER DEFAULT 0,
  winery_count  INTEGER DEFAULT 0,
  rating_count  INTEGER DEFAULT 0,
  rating_avg    REAL,
  rating_score  REAL,
  abv_avg       REAL,
  top_grape     TEXT,
  top_type      TEXT,
  critic_n      INTEGER DEFAULT 0,
  critic_points REAL,
  critic_price  REAL
);

CREATE TABLE regions (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  country      TEXT,
  country_code TEXT,
  wine_count   INTEGER DEFAULT 0,
  winery_count INTEGER DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  rating_avg   REAL,
  rating_score REAL,
  top_grape    TEXT,
  top_type     TEXT
);
CREATE INDEX regions_country ON regions(country);

CREATE TABLE wineries (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  country      TEXT,
  region       TEXT,
  region_id    INTEGER,
  website      TEXT,
  wine_count   INTEGER DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  rating_avg   REAL,
  rating_score REAL
);
CREATE INDEX wineries_country ON wineries(country);

CREATE TABLE critic_reviews (
  id          INTEGER PRIMARY KEY,
  title       TEXT,
  wine_name   TEXT,
  vintage     INTEGER,
  variety     TEXT,
  grape_key   TEXT,
  country     TEXT,
  province    TEXT,
  region      TEXT,
  winery      TEXT,
  points      INTEGER,
  price       REAL,
  value       REAL,          -- points per currency unit, for "best value" lists
  taster      TEXT,
  description TEXT
);
CREATE INDEX critic_variety ON critic_reviews(grape_key);
CREATE INDEX critic_country ON critic_reviews(country);
CREATE INDEX critic_points ON critic_reviews(points DESC);
CREATE INDEX critic_price ON critic_reviews(price);
CREATE INDEX critic_value ON critic_reviews(value DESC);
CREATE INDEX critic_vintage ON critic_reviews(vintage);

CREATE TABLE critic_stats (
  scope       TEXT NOT NULL,      -- 'grape' | 'country' | 'grape_country'
  key         TEXT NOT NULL,
  n           INTEGER NOT NULL,
  points_avg  REAL,
  price_avg   REAL,
  price_med   REAL,
  price_p10   REAL,
  price_p90   REAL,
  PRIMARY KEY (scope, key)
);

CREATE TABLE descriptors (
  scope    TEXT NOT NULL,         -- 'global' | 'grape' | 'country'
  key      TEXT NOT NULL,
  word     TEXT NOT NULL,
  family   TEXT NOT NULL,
  n        INTEGER NOT NULL,
  share    REAL NOT NULL,         -- share of reviews in this scope mentioning it
  lift     REAL NOT NULL,         -- share relative to the global share
  PRIMARY KEY (scope, key, word)
);
CREATE INDEX descriptors_lookup ON descriptors(scope, key, n DESC);

/*
 * Bottle identity. A label is one wine made across many vintages — "Ponzi
 * Reserve Pinot Noir, Willamette Valley" — which is what somebody is holding
 * when they type a name or photograph a bottle. lookup_index is the one fuzzy
 * index the resolver searches: catalogue wines and critic labels side by side.
 */
CREATE TABLE critic_labels (
  id          INTEGER PRIMARY KEY,
  winery      TEXT NOT NULL,
  designation TEXT,
  variety     TEXT,
  grape_key   TEXT,
  region      TEXT,
  province    TEXT,
  country     TEXT,
  n           INTEGER NOT NULL,
  vintage_min INTEGER,
  vintage_max INTEGER,
  points_avg  REAL,
  points_max  INTEGER,
  price_med   REAL,
  price_min   REAL,
  price_max   REAL
);
CREATE INDEX critic_labels_winery ON critic_labels(winery);
CREATE INDEX critic_labels_variety ON critic_labels(grape_key);

CREATE TABLE critic_label_vintages (
  label_id  INTEGER NOT NULL,
  vintage   INTEGER NOT NULL,
  review_id INTEGER NOT NULL,
  points    INTEGER,
  price     REAL,
  PRIMARY KEY (label_id, vintage, review_id)
);
CREATE INDEX critic_label_vintages_vintage ON critic_label_vintages(label_id, vintage);

CREATE TABLE lookup_index (
  id      INTEGER PRIMARY KEY,
  kind    TEXT NOT NULL,          -- 'wine' (catalogue) | 'label' (critic corpus)
  ref     INTEGER NOT NULL,
  winery  TEXT,
  name    TEXT,
  terms   TEXT NOT NULL,          -- normalised token bag used for scoring
  weight  REAL NOT NULL DEFAULT 1 -- prior: how much evidence backs this entry
);
CREATE INDEX lookup_index_kind ON lookup_index(kind, ref);

CREATE VIRTUAL TABLE lookup_fts USING fts5(
  terms,
  tokenize = "unicode61 remove_diacritics 2"
);

CREATE VIRTUAL TABLE wines_fts USING fts5(
  name, winery, region, country, grapes, pairings,
  tokenize = "unicode61 remove_diacritics 2"
);

CREATE VIRTUAL TABLE critic_fts USING fts5(
  title, variety, winery, description,
  tokenize = "unicode61 remove_diacritics 2"
);
`;

/**
 * The user's own data: cellar, tasting notes, wishlist. Lives in its own file,
 * attached as `cellar`, so rebuilding the catalogue never touches it.
 */
export const CELLAR_SCHEMA = `
CREATE TABLE IF NOT EXISTS cellar.cellar_bottles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  wine_id      INTEGER NOT NULL,
  vintage      INTEGER,
  quantity     INTEGER NOT NULL DEFAULT 1,
  price_paid   REAL,
  currency     TEXT DEFAULT 'EUR',
  purchased_on TEXT,
  drink_from   INTEGER,
  drink_to     INTEGER,
  location     TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS cellar.cellar_bottles_wine ON cellar_bottles(wine_id);

CREATE TABLE IF NOT EXISTS cellar.tasting_notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  wine_id    INTEGER NOT NULL,
  vintage    INTEGER,
  rating     REAL,
  notes      TEXT,
  tasted_on  TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS cellar.tasting_notes_wine ON tasting_notes(wine_id);

CREATE TABLE IF NOT EXISTS cellar.wishlist (
  wine_id    INTEGER PRIMARY KEY,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/* Live merchant prices, cached with the timestamp they were fetched. */
CREATE TABLE IF NOT EXISTS cellar.price_quotes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  provider    TEXT NOT NULL,
  query       TEXT NOT NULL,
  vintage     INTEGER,
  wine_id     INTEGER,
  label_id    INTEGER,
  name        TEXT,
  merchant    TEXT,
  price       REAL,
  currency    TEXT,
  url         TEXT,
  in_stock    INTEGER,
  fetched_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS cellar.price_quotes_lookup ON price_quotes(provider, query, vintage, fetched_at DESC);

CREATE TABLE IF NOT EXISTS cellar.taste_profile (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  profile    TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
