import httpx
from typing import Any, Dict


class WildFireConnector:
    def __init__(self, api_key: str, base_url: str = "https://wildfire.paloaltonetworks.com"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    async def test_connection(self) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/publicapi/get/verdict",
                data={"apikey": self.api_key, "hash": "d41d8cd98f00b204e9800998ecf8427e"},
                timeout=15,
            )
            return {"status": "connected", "http_status": resp.status_code}

    async def get_verdict(self, file_hash: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/publicapi/get/verdict",
                data={"apikey": self.api_key, "hash": file_hash},
                timeout=20,
            )
            resp.raise_for_status()
            text = resp.text
            verdict_map = {
                "0": "benign",
                "1": "malware",
                "2": "grayware",
                "4": "phishing",
                "-100": "pending",
                "-101": "not_found",
                "-102": "error",
            }
            verdict_code = ""
            if "<verdict>" in text:
                start = text.index("<verdict>") + 9
                end = text.index("</verdict>")
                verdict_code = text[start:end].strip()
            return {
                "hash": file_hash,
                "verdict": verdict_map.get(verdict_code, f"unknown ({verdict_code})"),
                "verdict_code": verdict_code,
            }

    async def get_report(self, file_hash: str, report_format: str = "xml") -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/publicapi/get/report",
                data={"apikey": self.api_key, "hash": file_hash, "format": report_format},
                timeout=30,
            )
            resp.raise_for_status()
            return {
                "hash": file_hash,
                "report": resp.text,
                "format": report_format,
                "status": resp.status_code,
            }

    async def submit_url(self, url: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/publicapi/submit/url",
                data={"apikey": self.api_key, "url": url},
                timeout=20,
            )
            resp.raise_for_status()
            return {"url": url, "response": resp.text, "status": resp.status_code}
