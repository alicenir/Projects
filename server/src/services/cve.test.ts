import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  assessCve,
  buildFinding,
  compareVersions,
  cpeMatchCoversVersion,
  cpeTargetsProduct,
  riskScore,
} from "./cveScoring.js";
import type { StackComponent } from "./inventory.js";

/**
 * Fixtures are real NVD 2.0 records (trimmed to the fields we read), so these
 * tests pin the parsing to the shape the API actually returns rather than to
 * an idea of it.
 */
const fixtures = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const load = (name: string) => JSON.parse(readFileSync(join(fixtures, `${name}.json`), "utf8"));

const PLEX = load("plex-cve-2020-5741");
const TRAEFIK = load("traefik-cve-2024-45410");
const RUNC = load("runc-cve-2024-21626");

const PLEX_CPE = "cpe:2.3:a:plex:media_server";
const TRAEFIK_CPE = "cpe:2.3:a:traefik:traefik";

function component(over: Partial<StackComponent> = {}): StackComponent {
  return {
    key: "plex",
    name: "Plex Media Server",
    version: "1.19.2",
    source: "test",
    cpe: PLEX_CPE,
    keyword: "Plex Media Server",
    ...over,
  };
}

test("compareVersions orders dotted versions numerically", () => {
  assert.ok(compareVersions("1.19.3", "1.19.2") > 0);
  assert.ok(compareVersions("1.9.0", "1.10.0") < 0, "9 < 10, not lexicographic");
  assert.equal(compareVersions("2.11", "2.11.0"), 0, "missing segments count as zero");
  assert.ok(compareVersions("1.32.7.7621", "1.32.7.7000") > 0);
});

test("cpeTargetsProduct compares part, vendor and product only", () => {
  assert.ok(cpeTargetsProduct("cpe:2.3:a:plex:media_server:*:*:*:*:*:*:*:*", PLEX_CPE));
  assert.ok(!cpeTargetsProduct("cpe:2.3:a:microsoft:windows:-:*:*:*:*:*:*:*", PLEX_CPE));
  assert.ok(!cpeTargetsProduct("cpe:2.3:o:plex:media_server:*:*:*:*:*:*:*:*", PLEX_CPE), "part differs");
  assert.ok(!cpeTargetsProduct(undefined, PLEX_CPE));
});

test("cpeMatchCoversVersion honours every range form NVD uses", () => {
  const endExcluding = { criteria: "cpe:2.3:a:x:y:*:*:*:*:*:*:*:*", versionEndExcluding: "1.19.3" };
  assert.ok(cpeMatchCoversVersion(endExcluding, "1.19.2"));
  assert.ok(!cpeMatchCoversVersion(endExcluding, "1.19.3"), "the fixed release is out of range");

  const window = {
    criteria: "cpe:2.3:a:x:y:*:*:*:*:*:*:*:*",
    versionStartIncluding: "3.0.0",
    versionEndExcluding: "3.1.3",
  };
  assert.ok(cpeMatchCoversVersion(window, "3.0.0"));
  assert.ok(cpeMatchCoversVersion(window, "3.1.2"));
  assert.ok(!cpeMatchCoversVersion(window, "2.9.9"));
  assert.ok(!cpeMatchCoversVersion(window, "3.1.3"));

  const exact = { criteria: "cpe:2.3:a:x:y:1.2.3:*:*:*:*:*:*:*" };
  assert.ok(cpeMatchCoversVersion(exact, "1.2.3"));
  assert.ok(!cpeMatchCoversVersion(exact, "1.2.4"));

  const open = { criteria: "cpe:2.3:a:x:y:*:*:*:*:*:*:*:*" };
  assert.ok(cpeMatchCoversVersion(open, "9.9.9"), "no bounds means every version");
});

test("assessCve resolves a real Plex advisory against installed versions", () => {
  const vulnerable = assessCve(PLEX, PLEX_CPE, "1.19.2");
  assert.deepEqual(vulnerable, { status: "affected", fixedIn: "1.19.3" });

  assert.equal(assessCve(PLEX, PLEX_CPE, "1.19.3"), null, "patched build is filtered out entirely");
  assert.equal(assessCve(PLEX, PLEX_CPE, "1.40.0"), null);

  assert.deepEqual(assessCve(PLEX, PLEX_CPE, null), { status: "possible", fixedIn: null });
  assert.deepEqual(
    assessCve(PLEX, null, "1.19.2"),
    { status: "unknown", fixedIn: null },
    "a keyword-only component can't be version-matched"
  );
  assert.deepEqual(
    assessCve(PLEX, TRAEFIK_CPE, "1.19.2"),
    { status: "unknown", fixedIn: null },
    "an unrelated product yields no CPE evidence"
  );
});

test("assessCve handles a record with two disjoint affected ranges", () => {
  assert.equal(assessCve(TRAEFIK, TRAEFIK_CPE, "2.11.8")?.status, "affected");
  assert.equal(assessCve(TRAEFIK, TRAEFIK_CPE, "2.11.9"), null);
  assert.deepEqual(assessCve(TRAEFIK, TRAEFIK_CPE, "3.1.0"), {
    status: "affected",
    fixedIn: "3.1.3",
  });
  assert.equal(assessCve(TRAEFIK, TRAEFIK_CPE, "3.1.3"), null);
});

test("assessCve reads nested AND configurations (runc inside Docker)", () => {
  const runc = component({
    key: "runc",
    name: "runc",
    cpe: "cpe:2.3:a:linuxfoundation:runc",
    version: "1.1.11",
  });
  const result = assessCve(RUNC, runc.cpe, runc.version);
  assert.ok(result, "runc 1.1.11 predates the fix and must be reported");
  assert.equal(result.status, "affected");
});

test("riskScore treats KEV membership as a hard override", () => {
  const kev = riskScore({ cvss: 4.3, epss: 0.0001, kev: true, status: "affected" });
  assert.deepEqual(kev, { score: 100, level: "critical" });

  const worseOnPaper = riskScore({ cvss: 10, epss: 0.9, kev: false, status: "affected" });
  assert.ok(kev.score > worseOnPaper.score, "actively exploited outranks theoretically severe");
  assert.ok(worseOnPaper.score < 100, "only KEV reaches the top of the scale");
});

test("riskScore keeps the CVSS band when nothing is known about exploitation", () => {
  assert.equal(riskScore({ cvss: 9.8, epss: 0, kev: false, status: "affected" }).level, "critical");
  assert.equal(riskScore({ cvss: 7.5, epss: 0, kev: false, status: "affected" }).level, "high");
  assert.equal(riskScore({ cvss: 5.0, epss: 0, kev: false, status: "affected" }).level, "medium");
  assert.equal(riskScore({ cvss: 3.0, epss: 0, kev: false, status: "affected" }).level, "low");
  assert.equal(
    riskScore({ cvss: null, epss: null, kev: false, status: "affected" }).level,
    "medium",
    "an unscored CVE is middling, not harmless"
  );
});

test("riskScore separates equally severe CVEs by exploitation likelihood", () => {
  const likely = riskScore({ cvss: 7.5, epss: 0.85, kev: false, status: "affected" });
  const unlikely = riskScore({ cvss: 7.5, epss: 0.001, kev: false, status: "affected" });
  assert.ok(likely.score > unlikely.score);
  assert.equal(likely.level, "critical", "a HIGH that is actively exploited is promoted");
  assert.equal(unlikely.level, "high", "the same HIGH with no exploitation stays put");
});

test("riskScore discounts findings that aren't confirmed against a version", () => {
  const confirmed = riskScore({ cvss: 9.8, epss: 0.5, kev: false, status: "affected" });
  const guess = riskScore({ cvss: 9.8, epss: 0.5, kev: false, status: "possible" });
  assert.ok(confirmed.score > guess.score);
});

test("buildFinding turns a KEV advisory into a complete, sorted finding", () => {
  const finding = buildFinding(PLEX, component(), { epss: 0.7, percentile: 0.98 });
  assert.ok(finding);
  assert.equal(finding.id, "CVE-2020-5741");
  assert.equal(finding.component, "plex");
  assert.equal(finding.status, "affected");
  assert.equal(finding.kev, true);
  assert.equal(finding.kevAddedAt, "2023-03-10");
  assert.equal(finding.level, "critical");
  assert.equal(finding.score, 100);
  assert.equal(finding.fixedIn, "1.19.3");
  assert.equal(finding.cvss, 7.2);
  assert.equal(finding.severity, "HIGH");
  assert.ok(finding.cwes.includes("CWE-502"));
  assert.equal(finding.url, "https://nvd.nist.gov/vuln/detail/CVE-2020-5741");
  assert.ok(finding.summary.length > 0);
});

test("buildFinding drops advisories that don't apply to the installed build", () => {
  assert.equal(buildFinding(PLEX, component({ version: "1.19.3" }), null), null);
});
