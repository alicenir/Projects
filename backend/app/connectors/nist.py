import httpx
from typing import Any, Dict, List, Optional


class NISTConnector:
    BASE_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"

    def __init__(self, api_key: str = ""):
        self.api_key = api_key
        self.headers = {"apiKey": api_key} if api_key else {}

    async def test_connection(self) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                self.BASE_URL,
                params={"resultsPerPage": 1},
                headers=self.headers,
                timeout=15,
            )
            resp.raise_for_status()
            return {"status": "connected", "total_cves": resp.json().get("totalResults", 0)}

    async def get_cve(self, cve_id: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                self.BASE_URL,
                params={"cveId": cve_id},
                headers=self.headers,
                timeout=20,
            )
            resp.raise_for_status()
            vulns = resp.json().get("vulnerabilities", [])
            if not vulns:
                return {"found": False, "cve_id": cve_id}
            cve = vulns[0]["cve"]
            metrics = cve.get("metrics", {})
            cvss_v3 = metrics.get("cvssMetricV31", metrics.get("cvssMetricV30", [{}]))[0] if (
                metrics.get("cvssMetricV31") or metrics.get("cvssMetricV30")
            ) else {}
            cvss_data = cvss_v3.get("cvssData", {}) if cvss_v3 else {}
            return {
                "found": True,
                "cve_id": cve_id,
                "description": next(
                    (d["value"] for d in cve.get("descriptions", []) if d["lang"] == "en"), ""
                ),
                "severity": cvss_data.get("baseSeverity", "N/A"),
                "base_score": cvss_data.get("baseScore", 0),
                "vector": cvss_data.get("vectorString", ""),
                "published": cve.get("published", ""),
                "modified": cve.get("lastModified", ""),
                "weaknesses": [
                    w["description"][0]["value"]
                    for w in cve.get("weaknesses", [])
                    if w.get("description")
                ],
                "references": [r["url"] for r in cve.get("references", [])[:5]],
            }

    async def search_cves(
        self,
        keyword: str = "",
        severity: str = "",
        limit: int = 10,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {"resultsPerPage": limit}
        if keyword:
            params["keywordSearch"] = keyword
        if severity:
            params["cvssV3Severity"] = severity.upper()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                self.BASE_URL,
                params=params,
                headers=self.headers,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            results = []
            for item in data.get("vulnerabilities", []):
                cve = item["cve"]
                metrics = cve.get("metrics", {})
                cvss_list = metrics.get("cvssMetricV31", metrics.get("cvssMetricV30", []))
                score = cvss_list[0]["cvssData"]["baseScore"] if cvss_list else 0
                severity_val = cvss_list[0]["cvssData"].get("baseSeverity", "N/A") if cvss_list else "N/A"
                results.append({
                    "id": cve["id"],
                    "description": next(
                        (d["value"][:200] for d in cve.get("descriptions", []) if d["lang"] == "en"), ""
                    ),
                    "score": score,
                    "severity": severity_val,
                    "published": cve.get("published", ""),
                })
            return {"total": data.get("totalResults", 0), "results": results}
