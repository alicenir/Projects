import httpx
from typing import Any, Dict


class VirusTotalConnector:
    BASE_URL = "https://www.virustotal.com/api/v3"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {"x-apikey": api_key}

    async def test_connection(self) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.BASE_URL}/users/me",
                headers=self.headers,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            return {"status": "connected", "quota": data.get("data", {}).get("attributes", {}).get("quotas")}

    async def scan_file_hash(self, file_hash: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.BASE_URL}/files/{file_hash}",
                headers=self.headers,
                timeout=20,
            )
            if resp.status_code == 404:
                return {"found": False, "hash": file_hash}
            resp.raise_for_status()
            attrs = resp.json().get("data", {}).get("attributes", {})
            stats = attrs.get("last_analysis_stats", {})
            return {
                "found": True,
                "hash": file_hash,
                "malicious": stats.get("malicious", 0),
                "suspicious": stats.get("suspicious", 0),
                "undetected": stats.get("undetected", 0),
                "harmless": stats.get("harmless", 0),
                "name": attrs.get("meaningful_name", ""),
                "type": attrs.get("type_description", ""),
                "size": attrs.get("size", 0),
                "reputation": attrs.get("reputation", 0),
                "tags": attrs.get("tags", []),
            }

    async def scan_url(self, url: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            submit = await client.post(
                f"{self.BASE_URL}/urls",
                headers=self.headers,
                data={"url": url},
                timeout=20,
            )
            submit.raise_for_status()
            analysis_id = submit.json()["data"]["id"]
            result = await client.get(
                f"{self.BASE_URL}/analyses/{analysis_id}",
                headers=self.headers,
                timeout=30,
            )
            result.raise_for_status()
            attrs = result.json().get("data", {}).get("attributes", {})
            stats = attrs.get("stats", {})
            return {
                "url": url,
                "malicious": stats.get("malicious", 0),
                "suspicious": stats.get("suspicious", 0),
                "undetected": stats.get("undetected", 0),
                "harmless": stats.get("harmless", 0),
                "status": attrs.get("status", ""),
            }

    async def scan_ip(self, ip: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.BASE_URL}/ip_addresses/{ip}",
                headers=self.headers,
                timeout=20,
            )
            resp.raise_for_status()
            attrs = resp.json().get("data", {}).get("attributes", {})
            stats = attrs.get("last_analysis_stats", {})
            return {
                "ip": ip,
                "country": attrs.get("country", ""),
                "asn": attrs.get("asn", ""),
                "as_owner": attrs.get("as_owner", ""),
                "malicious": stats.get("malicious", 0),
                "suspicious": stats.get("suspicious", 0),
                "reputation": attrs.get("reputation", 0),
                "tags": attrs.get("tags", []),
            }

    async def scan_domain(self, domain: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.BASE_URL}/domains/{domain}",
                headers=self.headers,
                timeout=20,
            )
            resp.raise_for_status()
            attrs = resp.json().get("data", {}).get("attributes", {})
            stats = attrs.get("last_analysis_stats", {})
            return {
                "domain": domain,
                "malicious": stats.get("malicious", 0),
                "suspicious": stats.get("suspicious", 0),
                "reputation": attrs.get("reputation", 0),
                "categories": attrs.get("categories", {}),
                "creation_date": attrs.get("creation_date"),
                "registrar": attrs.get("registrar", ""),
            }
