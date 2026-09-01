import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Exercises the whole path — discover what's installed, query NVD/EPSS, score,
 * cache, serve — against local stand-ins for both the LAN services and the
 * public APIs. The NVD payload is a real record wrapped in the real envelope,
 * so this fails if the response shape we parse ever stops matching.
 */

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const PLEX_CVE = JSON.parse(readFileSync(join(fixtures, "plex-cve-2020-5741.json"), "utf8"));

let stub: Server;
let dataDir: string;
let nvdQueries: string[] = [];
let epssQueries: string[] = [];
// Mutable so a test can simulate upgrading Plex past the fix.
let plexVersion = "1.19.2.2792";

// Modules are imported dynamically because db.ts opens its database at import
// time — DATA_DIR has to be pointing somewhere disposable first.
let db: typeof import("../db.js");
let cve: typeof import("./cve.js");
let inventory: typeof import("./inventory.js");

before(async () => {
  const port = await new Promise<number>((resolve) => {
    stub = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const send = (body: unknown) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
      };

      // --- stand-in for Tautulli on the LAN ---
      if (url.pathname === "/tautulli/api/v2") {
        const cmd = url.searchParams.get("cmd");
        if (cmd === "update_check") {
          return send({ response: { result: "success", data: { tautulli_version: "v2.14.0" } } });
        }
        if (cmd === "get_server_info") {
          return send({ response: { result: "success", data: { pms_version: plexVersion } } });
        }
        return send({ response: { result: "error", message: "unknown command" } });
      }

      // --- stand-in for NVD 2.0 ---
      if (url.pathname === "/nvd") {
        const query = url.search;
        nvdQueries.push(query);
        const wantsPlex =
          (url.searchParams.get("virtualMatchString") ?? "").includes("plex:media_server");
        const vulnerabilities = wantsPlex ? [{ cve: PLEX_CVE }] : [];
        return send({
          resultsPerPage: vulnerabilities.length,
          startIndex: 0,
          totalResults: vulnerabilities.length,
          format: "NVD_CVE",
          version: "2.0",
          vulnerabilities,
        });
      }

      // --- stand-in for FIRST's EPSS ---
      if (url.pathname === "/epss") {
        epssQueries.push(url.search);
        const ids = (url.searchParams.get("cve") ?? "").split(",").filter(Boolean);
        return send({
          status: "OK",
          data: ids.map((id) => ({ cve: id, epss: "0.90218", percentile: "0.99542" })),
        });
      }

      res.writeHead(404);
      res.end();
    });
    stub.listen(0, "127.0.0.1", () => resolve((stub.address() as { port: number }).port));
  });

  dataDir = mkdtempSync(join(tmpdir(), "homebase-cve-"));
  process.env.DATA_DIR = dataDir;
  process.env.NVD_API_URL = `http://127.0.0.1:${port}/nvd`;
  process.env.EPSS_API_URL = `http://127.0.0.1:${port}/epss`;

  db = await import("../db.js");
  inventory = await import("./inventory.js");
  cve = await import("./cve.js");

  db.setSetting("tautulli_url", `http://127.0.0.1:${port}/tautulli`);
  db.setSetting("tautulli_api_key", "test-key");
  db.setSetting("security_enabled", "true");
  // Present only to pick the faster request spacing; the stub ignores it.
  db.setSetting("nvd_api_key", "test-key");
  inventory.invalidateInventoryCache();
});

after(() => {
  cve?.stopSecurityPolling();
  stub?.close();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test("discovers Plex and Tautulli from a configured Tautulli integration", async () => {
  const stack = await inventory.detectStack(true);
  const byKey = Object.fromEntries(stack.map((c) => [c.key, c]));

  assert.equal(byKey.tautulli?.version, "2.14.0", "the leading v is stripped");
  assert.equal(byKey.plex?.version, "1.19.2.2792");
  assert.equal(byKey.plex?.cpe, "cpe:2.3:a:plex:media_server");
  assert.equal(byKey.tautulli?.cpe, null, "no verified CPE, so it falls back to keyword search");
});

test("a full scan finds, scores and caches the KEV advisory", async () => {
  await cve.runScan(true);
  const snapshot = await cve.getSecurityStatus();

  assert.equal(snapshot.enabled, true);
  assert.equal(snapshot.configured, true);
  assert.equal(snapshot.scanning, false);
  assert.equal(snapshot.error, null);
  assert.ok(snapshot.scannedAt, "the scan timestamp is reported");

  assert.equal(snapshot.counts.total, 1);
  assert.equal(snapshot.counts.kev, 1);
  assert.equal(snapshot.counts.critical, 1);

  const [finding] = snapshot.findings;
  assert.equal(finding.id, "CVE-2020-5741");
  assert.equal(finding.component, "plex");
  assert.equal(finding.version, "1.19.2.2792");
  assert.equal(finding.status, "affected");
  assert.equal(finding.fixedIn, "1.19.3");
  assert.equal(finding.kev, true);
  assert.equal(finding.score, 100);
  assert.ok(finding.epss !== null && finding.epss > 0.9, "EPSS enrichment was applied");

  const plexReport = snapshot.components.find((c) => c.key === "plex");
  assert.equal(plexReport?.matchMode, "cpe");
  assert.equal(plexReport?.scanned, true);
  assert.equal(plexReport?.error, null);
});

test("the precise CPE query is preferred when a version is known", () => {
  const plexQuery = nvdQueries.find((q) => q.includes("plex"));
  assert.ok(plexQuery, "Plex was queried by CPE");
  assert.ok(plexQuery.includes("isVulnerable"), "NVD is asked to filter by version too");
  assert.ok(
    decodeURIComponent(plexQuery).includes("cpe:2.3:a:plex:media_server:1.19.2.2792"),
    "the installed version is part of the match string"
  );
  assert.ok(
    nvdQueries.some((q) => q.includes("keywordSearch=Tautulli")),
    "components without a CPE fall back to a keyword search"
  );
});

test("results survive a restart via the on-disk cache", async () => {
  nvdQueries = [];
  // A second scan inside the freshness window must not re-query NVD at all.
  await cve.runScan(false);
  assert.equal(nvdQueries.length, 0, "cached findings are reused");

  const snapshot = await cve.getSecurityStatus();
  assert.equal(snapshot.counts.total, 1, "and are still served");
});

test("a version bump invalidates the cached result for that component", async () => {
  nvdQueries = [];
  db.setSetting("security_enabled", "true");
  // Pretend Plex was upgraded past the fix; the stale entry must be rescanned.
  db.db.prepare("UPDATE cve_cache SET version = ? WHERE component = 'plex'").run("1.19.0");
  await cve.runScan(false);
  assert.ok(nvdQueries.length > 0, "the changed component was queried again");
});

test("an upgraded Plex clears the finding without an EPSS lookup", async () => {
  plexVersion = "1.25.0.5282"; // comfortably past the 1.19.3 fix
  inventory.invalidateInventoryCache();
  db.db.prepare("DELETE FROM cve_cache").run();
  nvdQueries = [];
  epssQueries = [];

  await cve.runScan(true);
  const snapshot = await cve.getSecurityStatus();

  assert.ok(nvdQueries.length > 0, "NVD was still consulted");
  assert.equal(snapshot.counts.total, 0, "the advisory no longer applies");
  assert.equal(
    epssQueries.length,
    0,
    "EPSS is only consulted for advisories that survive version matching"
  );

  const plexReport = snapshot.components.find((c) => c.key === "plex");
  assert.equal(plexReport?.scanned, true, "the component is still reported as checked");
  assert.equal(plexReport?.version, "1.25.0.5282");
});

test("scanning is skipped entirely when the feature is switched off", async () => {
  db.setSetting("security_enabled", "false");
  nvdQueries = [];
  await cve.runScan(true);
  assert.equal(nvdQueries.length, 0);

  const snapshot = await cve.getSecurityStatus();
  assert.equal(snapshot.enabled, false);
  assert.equal(snapshot.configured, false, "the widget hides itself when disabled");
});
