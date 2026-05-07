import httpx
import base64
from typing import Any, Dict, List, Optional


class ConfluenceConnector:
    def __init__(self, base_url: str, email: str, api_token: str, space_key: str = ""):
        self.base_url = base_url.rstrip("/")
        self.space_key = space_key
        token = base64.b64encode(f"{email}:{api_token}".encode()).decode()
        self.headers = {
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
        }

    async def test_connection(self) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/wiki/rest/api/user/current",
                headers=self.headers,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            return {"status": "connected", "user": data.get("displayName", "")}

    async def search_content(self, query: str, limit: int = 10) -> Dict[str, Any]:
        params: Dict[str, Any] = {
            "cql": f'text ~ "{query}" AND type = "page"',
            "limit": limit,
            "expand": "body.storage,metadata.labels",
        }
        if self.space_key:
            params["cql"] = f'space = "{self.space_key}" AND ' + params["cql"]
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/wiki/rest/api/content/search",
                params=params,
                headers=self.headers,
                timeout=20,
            )
            resp.raise_for_status()
            data = resp.json()
            results = []
            for page in data.get("results", []):
                body = page.get("body", {}).get("storage", {}).get("value", "")
                clean_body = body[:500].replace("<", " <").replace(">", "> ") if body else ""
                results.append({
                    "id": page["id"],
                    "title": page["title"],
                    "url": f"{self.base_url}/wiki{page.get('_links', {}).get('webui', '')}",
                    "excerpt": clean_body[:300],
                    "labels": [
                        lbl["name"]
                        for lbl in page.get("metadata", {}).get("labels", {}).get("results", [])
                    ],
                })
            return {"total": data.get("totalSize", 0), "results": results}

    async def get_page(self, page_id: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/wiki/rest/api/content/{page_id}",
                params={"expand": "body.storage,version,ancestors"},
                headers=self.headers,
                timeout=20,
            )
            resp.raise_for_status()
            page = resp.json()
            return {
                "id": page["id"],
                "title": page["title"],
                "body": page.get("body", {}).get("storage", {}).get("value", ""),
                "version": page.get("version", {}).get("number", 1),
                "url": f"{self.base_url}/wiki{page.get('_links', {}).get('webui', '')}",
            }

    async def create_page(self, title: str, content: str, parent_id: Optional[str] = None) -> Dict[str, Any]:
        body: Dict[str, Any] = {
            "type": "page",
            "title": title,
            "space": {"key": self.space_key},
            "body": {"storage": {"value": content, "representation": "storage"}},
        }
        if parent_id:
            body["ancestors"] = [{"id": parent_id}]
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/wiki/rest/api/content",
                json=body,
                headers=self.headers,
                timeout=20,
            )
            resp.raise_for_status()
            page = resp.json()
            return {
                "id": page["id"],
                "title": page["title"],
                "url": f"{self.base_url}/wiki{page.get('_links', {}).get('webui', '')}",
            }
