/**
 * Pure vulnerability-matching and prioritisation logic, kept free of database
 * and network imports so it can be exercised directly against recorded NVD
 * records (see cve.test.ts). cve.ts owns the I/O and calls into this.
 */

export type FindingStatus = "affected" | "possible" | "unknown";
export type RiskLevel = "critical" | "high" | "medium" | "low";

/** The bits of an inventory entry the scoring needs; StackComponent satisfies it. */
export interface ScoredComponent {
  key: string;
  name: string;
  version: string | null;
  cpe: string | null;
}

export interface EpssEntry {
  epss: number;
  percentile: number;
}

export interface Finding {
  id: string;
  component: string;
  componentName: string;
  version: string | null;
  status: FindingStatus;
  summary: string;
  published: string | null;
  lastModified: string | null;
  cvss: number | null;
  severity: string | null;
  vector: string | null;
  cwes: string[];
  kev: boolean;
  kevAddedAt: string | null;
  kevDueAt: string | null;
  epss: number | null;
  epssPercentile: number | null;
  score: number;
  level: RiskLevel;
  fixedIn: string | null;
  url: string;
}

export interface CpeMatch {
  vulnerable?: boolean;
  criteria?: string;
  versionStartIncluding?: string;
  versionStartExcluding?: string;
  versionEndIncluding?: string;
  versionEndExcluding?: string;
}

/** Numeric dotted-version compare. Returns <0, 0, >0 like a sort comparator. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = Number.parseInt(pa[i] ?? "0", 10) || 0;
    const nb = Number.parseInt(pb[i] ?? "0", 10) || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

/** True when `criteria` names the same part/vendor/product as `prefix`. */
export function cpeTargetsProduct(criteria: string | undefined, prefix: string): boolean {
  if (!criteria) return false;
  const want = prefix.split(":").slice(0, 5);
  const got = criteria.split(":").slice(0, 5);
  if (want.length < 5 || got.length < 5) return false;
  return want.every((part, i) => part === got[i]);
}

/**
 * Whether a single CPE match rule covers `version`. NVD expresses ranges
 * either as an exact version in the 6th CPE field or as the four
 * versionStart/End attributes; both forms show up in real records.
 */
export function cpeMatchCoversVersion(match: CpeMatch, version: string): boolean {
  const exact = match.criteria?.split(":")[5];
  if (exact && exact !== "*" && exact !== "-") {
    return compareVersions(exact, version) === 0;
  }
  if (match.versionStartIncluding && compareVersions(version, match.versionStartIncluding) < 0) return false;
  if (match.versionStartExcluding && compareVersions(version, match.versionStartExcluding) <= 0) return false;
  if (match.versionEndIncluding && compareVersions(version, match.versionEndIncluding) > 0) return false;
  if (match.versionEndExcluding && compareVersions(version, match.versionEndExcluding) >= 0) return false;
  return true;
}

function collectMatches(cve: any, prefix: string | null): CpeMatch[] {
  if (!prefix) return [];
  const out: CpeMatch[] = [];
  const walk = (nodes: any[]) => {
    for (const node of nodes ?? []) {
      if (node?.negate) continue;
      for (const match of node?.cpeMatch ?? []) {
        if (match?.vulnerable && cpeTargetsProduct(match.criteria, prefix)) out.push(match);
      }
      if (Array.isArray(node?.children)) walk(node.children);
    }
  };
  for (const config of cve?.configurations ?? []) walk(config?.nodes ?? []);
  return out;
}

/**
 * Decide how a CVE relates to an installed version:
 *   affected  — NVD's ranges include this exact version
 *   possible  — the product matches but we can't pin the version down
 *   unknown   — no CPE data for this product (keyword hit, or unanalysed CVE)
 *   null      — NVD analysed it and this version is explicitly out of range
 */
export function assessCve(
  cve: any,
  prefix: string | null,
  version: string | null
): { status: FindingStatus; fixedIn: string | null } | null {
  const matches = collectMatches(cve, prefix);
  if (matches.length === 0) return { status: "unknown", fixedIn: null };
  if (!version) return { status: "possible", fixedIn: null };

  const hit = matches.find((m) => cpeMatchCoversVersion(m, version));
  if (!hit) return null;
  return { status: "affected", fixedIn: hit.versionEndExcluding ?? null };
}

/**
 * A single 0-100 number that sorts a queue of CVEs the way you'd actually work
 * it. The scale is anchored on CVSS so the number keeps its usual meaning — a
 * 9.8 still lands in "critical", a 5.0 still lands in "medium" — and EPSS then
 * nudges it up by how likely the bug is to actually be exploited in the next
 * 30 days, which is what separates two equally severe CVEs. Known active
 * exploitation overrides both: if CISA has it in the Known Exploited
 * Vulnerabilities catalog it is being used against real systems today, and the
 * CVSS argument is over.
 */
export function riskScore(input: {
  cvss: number | null;
  epss: number | null;
  kev: boolean;
  status: FindingStatus;
}): { score: number; level: RiskLevel } {
  if (input.kev) return { score: 100, level: "critical" };

  // An unscored CVE is treated as middling rather than harmless.
  const severity = (input.cvss ?? 5) * 10; // 0-100, the CVSS band itself
  const likelihood = (input.epss ?? 0) * 25; // up to a band-and-a-bit of lift
  // Findings we couldn't confirm against an installed version sort just below
  // otherwise-identical confirmed ones, without being buried.
  const confidence = input.status === "affected" ? 0 : 5;

  // Capped below 100 so nothing non-KEV can tie with active exploitation. The
  // cap is applied before the confidence penalty, or the penalty would vanish
  // for anything that had already saturated the scale.
  const score = Math.round(Math.max(0, Math.min(99, severity + likelihood) - confidence));
  const level: RiskLevel = score >= 90 ? "critical" : score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  return { score, level };
}

export function cvssOf(cve: any): { score: number | null; severity: string | null; vector: string | null } {
  const metrics = cve?.metrics ?? {};
  // Newest CVSS revision first; NVD keeps older ones alongside for old CVEs.
  for (const key of ["cvssMetricV40", "cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]) {
    const entries = metrics[key];
    if (!Array.isArray(entries) || entries.length === 0) continue;
    const primary = entries.find((e: any) => e?.type === "Primary") ?? entries[0];
    const data = primary?.cvssData ?? {};
    return {
      score: typeof data.baseScore === "number" ? data.baseScore : null,
      severity: data.baseSeverity ?? primary?.baseSeverity ?? null,
      vector: data.vectorString ?? null,
    };
  }
  return { score: null, severity: null, vector: null };
}

function describe(cve: any): string {
  const english = (cve?.descriptions ?? []).find((d: any) => d?.lang === "en");
  return (english?.value ?? "").trim();
}

function cwesOf(cve: any): string[] {
  const out = new Set<string>();
  for (const weakness of cve?.weaknesses ?? []) {
    for (const description of weakness?.description ?? []) {
      if (typeof description?.value === "string" && description.value.startsWith("CWE-")) {
        out.add(description.value);
      }
    }
  }
  return [...out];
}

/** Returns null when the advisory demonstrably doesn't apply to this build. */
export function buildFinding(
  cve: any,
  component: ScoredComponent,
  epss: EpssEntry | null
): Finding | null {
  const assessment = assessCve(cve, component.cpe, component.version);
  if (!assessment) return null;

  const { score: cvss, severity, vector } = cvssOf(cve);
  const kev = Boolean(cve?.cisaExploitAdd);
  const risk = riskScore({ cvss, epss: epss?.epss ?? null, kev, status: assessment.status });

  return {
    id: cve?.id ?? "",
    component: component.key,
    componentName: component.name,
    version: component.version,
    status: assessment.status,
    summary: describe(cve),
    published: cve?.published ?? null,
    lastModified: cve?.lastModified ?? null,
    cvss,
    severity,
    vector,
    cwes: cwesOf(cve),
    kev,
    kevAddedAt: cve?.cisaExploitAdd ?? null,
    kevDueAt: cve?.cisaActionDue ?? null,
    epss: epss?.epss ?? null,
    epssPercentile: epss?.percentile ?? null,
    score: risk.score,
    level: risk.level,
    fixedIn: assessment.fixedIn,
    url: `https://nvd.nist.gov/vuln/detail/${cve?.id ?? ""}`,
  };
}
