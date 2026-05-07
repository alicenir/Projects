import httpx
from typing import Any, Dict, Optional


class CrowdStrikeConnector:
    def __init__(self, client_id: str, client_secret: str, base_url: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.base_url = base_url.rstrip("/")
        self._token: Optional[str] = None

    async def _get_token(self) -> str:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/oauth2/token",
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=15,
            )
            resp.raise_for_status()
            self._token = resp.json()["access_token"]
            return self._token

    async def test_connection(self) -> Dict[str, Any]:
        token = await self._get_token()
        return {"status": "connected", "token_obtained": bool(token)}

    async def get_detections(self, limit: int = 10) -> Dict[str, Any]:
        token = await self._get_token()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/detects/queries/detects/v1",
                params={"limit": limit, "sort": "last_behavior|desc"},
                headers={"Authorization": f"Bearer {token}"},
                timeout=20,
            )
            resp.raise_for_status()
            ids = resp.json().get("resources", [])
            if not ids:
                return {"detections": []}
            detail_resp = await client.post(
                f"{self.base_url}/detects/entities/summaries/GET/v1",
                json={"ids": ids},
                headers={"Authorization": f"Bearer {token}"},
                timeout=20,
            )
            detail_resp.raise_for_status()
            return {"detections": detail_resp.json().get("resources", [])}

    async def search_indicators(self, ioc: str) -> Dict[str, Any]:
        token = await self._get_token()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/intel/combined/indicators/v1",
                params={"filter": f"indicator:'{ioc}'", "limit": 5},
                headers={"Authorization": f"Bearer {token}"},
                timeout=20,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_incidents(self, limit: int = 10) -> Dict[str, Any]:
        token = await self._get_token()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/incidents/queries/incidents/v1",
                params={"limit": limit, "sort": "start|desc"},
                headers={"Authorization": f"Bearer {token}"},
                timeout=20,
            )
            resp.raise_for_status()
            ids = resp.json().get("resources", [])
            if not ids:
                return {"incidents": []}
            detail_resp = await client.post(
                f"{self.base_url}/incidents/entities/incidents/GET/v1",
                json={"ids": ids},
                headers={"Authorization": f"Bearer {token}"},
                timeout=20,
            )
            detail_resp.raise_for_status()
            return {"incidents": detail_resp.json().get("resources", [])}
