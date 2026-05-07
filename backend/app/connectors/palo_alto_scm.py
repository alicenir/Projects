import httpx
from typing import Any, Dict, List, Optional


class PaloAltoSCMConnector:
    AUTH_URL = "https://auth.apps.paloaltonetworks.com/auth/v1/oauth2/access_token"

    def __init__(self, client_id: str, client_secret: str, tsg_id: str, base_url: str, instructions: str = ""):
        self.client_id = client_id
        self.client_secret = client_secret
        self.tsg_id = tsg_id
        self.base_url = base_url.rstrip("/")
        self.instructions = instructions
        self._token: Optional[str] = None

    async def _get_token(self) -> str:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                self.AUTH_URL,
                data={
                    "grant_type": "client_credentials",
                    "scope": f"tsg_id:{self.tsg_id}",
                },
                auth=(self.client_id, self.client_secret),
                timeout=15,
            )
            resp.raise_for_status()
            self._token = resp.json()["access_token"]
            return self._token

    async def test_connection(self) -> Dict[str, Any]:
        token = await self._get_token()
        return {"status": "connected", "token_obtained": bool(token)}

    async def get_security_events(self, limit: int = 50, severity: str = "") -> Dict[str, Any]:
        token = await self._get_token()
        params: Dict[str, Any] = {"limit": limit}
        if severity:
            params["severity"] = severity
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/sse/v1/log-service/query/threats",
                params=params,
                headers={"Authorization": f"Bearer {token}"},
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_traffic_logs(self, limit: int = 50, src_ip: str = "", dst_ip: str = "") -> Dict[str, Any]:
        token = await self._get_token()
        params: Dict[str, Any] = {"limit": limit}
        if src_ip:
            params["src"] = src_ip
        if dst_ip:
            params["dst"] = dst_ip
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/sse/v1/log-service/query/traffic",
                params=params,
                headers={"Authorization": f"Bearer {token}"},
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()

    async def analyze_logs(self, log_query: str, custom_instructions: str = "") -> Dict[str, Any]:
        """Fetch logs based on a natural language query with optional custom instructions."""
        token = await self._get_token()
        effective_instructions = custom_instructions or self.instructions
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/sse/v1/log-service/query",
                json={"query": log_query, "instructions": effective_instructions},
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_config_audit(self) -> Dict[str, Any]:
        token = await self._get_token()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/config/v1/config-versions",
                headers={"Authorization": f"Bearer {token}"},
                timeout=20,
            )
            resp.raise_for_status()
            return resp.json()
