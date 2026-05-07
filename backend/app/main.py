import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiofiles
from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.agent import SecOpsAgent
from app.config import get_settings, update_settings
from app.models import (
    ConnectorConfig,
    ConnectorDefinition,
    ConnectorField,
    SettingsUpdate,
    TestConnectionRequest,
)

app = FastAPI(title="SecOps Agent Platform", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

CONFIG_FILE = Path("/app/configs/connector_configs.json")
CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)

_connector_configs: Dict[str, Dict] = {}
_connector_instructions: Dict[str, str] = {}


def _load_configs() -> None:
    global _connector_configs, _connector_instructions
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE) as f:
                data = json.load(f)
                _connector_configs = data.get("credentials", {})
                _connector_instructions = data.get("instructions", {})
        except Exception:
            pass


def _save_configs() -> None:
    with open(CONFIG_FILE, "w") as f:
        json.dump({"credentials": _connector_configs, "instructions": _connector_instructions}, f)


_load_configs()


CONNECTOR_DEFINITIONS: List[Dict] = [
    {
        "id": "crowdstrike",
        "name": "CrowdStrike",
        "description": "Endpoint detection & response with threat intelligence",
        "category": "EDR",
        "icon": "shield-check",
        "color": "#e8162a",
        "fields": [
            {"key": "client_id", "label": "Client ID", "type": "text", "required": True},
            {"key": "client_secret", "label": "Client Secret", "type": "password", "required": True},
            {"key": "base_url", "label": "Base URL", "type": "text", "placeholder": "https://api.crowdstrike.com"},
        ],
        "has_instructions": False,
    },
    {
        "id": "anthropic",
        "name": "Anthropic Claude",
        "description": "AI-powered threat analysis and security reasoning",
        "category": "AI",
        "icon": "brain",
        "color": "#cc785c",
        "fields": [
            {"key": "api_key", "label": "API Key", "type": "password", "required": True},
            {"key": "model", "label": "Model", "type": "text", "placeholder": "claude-sonnet-4-6"},
        ],
        "has_instructions": False,
    },
    {
        "id": "virustotal",
        "name": "VirusTotal",
        "description": "Multi-engine file, URL, IP, and domain scanning",
        "category": "Threat Intel",
        "icon": "scan-line",
        "color": "#3949ab",
        "fields": [
            {"key": "api_key", "label": "API Key", "type": "password", "required": True},
        ],
        "has_instructions": False,
    },
    {
        "id": "nist",
        "name": "NIST NVD",
        "description": "National Vulnerability Database — CVE lookup and search",
        "category": "Vulnerability",
        "icon": "database",
        "color": "#00897b",
        "fields": [
            {"key": "api_key", "label": "API Key (optional)", "type": "password", "required": False,
             "placeholder": "Rate-limited without key"},
        ],
        "has_instructions": False,
    },
    {
        "id": "wildfire",
        "name": "Palo Alto WildFire",
        "description": "Cloud-based malware analysis and sandbox detonation",
        "category": "Sandbox",
        "icon": "flame",
        "color": "#ff6d00",
        "fields": [
            {"key": "api_key", "label": "API Key", "type": "password", "required": True},
            {"key": "base_url", "label": "Base URL", "type": "text", "placeholder": "https://wildfire.paloaltonetworks.com"},
        ],
        "has_instructions": False,
    },
    {
        "id": "palo_alto_scm",
        "name": "Palo Alto SCM",
        "description": "Strata Cloud Manager log management and threat analytics",
        "category": "NGFW",
        "icon": "activity",
        "color": "#fa4f21",
        "fields": [
            {"key": "client_id", "label": "Client ID", "type": "text", "required": True},
            {"key": "client_secret", "label": "Client Secret", "type": "password", "required": True},
            {"key": "tsg_id", "label": "TSG ID", "type": "text", "required": True},
            {"key": "base_url", "label": "Base URL", "type": "text", "placeholder": "https://api.sase.paloaltonetworks.com"},
        ],
        "has_instructions": True,
        "instructions_label": "Log Analysis Instructions",
        "instructions_placeholder": "e.g., Focus on lateral movement, flag any traffic to known C2 ranges 10.0.0.0/8, alert on port 4444 connections, escalate all CRITICAL and HIGH severity events...",
    },
    {
        "id": "confluence",
        "name": "Confluence",
        "description": "Organizational knowledge base for runbooks and policies",
        "category": "Knowledge",
        "icon": "book-open",
        "color": "#0052cc",
        "fields": [
            {"key": "base_url", "label": "Instance URL", "type": "text", "required": True,
             "placeholder": "https://yourorg.atlassian.net"},
            {"key": "email", "label": "Email", "type": "text", "required": True},
            {"key": "api_token", "label": "API Token", "type": "password", "required": True},
            {"key": "space_key", "label": "Space Key (optional)", "type": "text"},
        ],
        "has_instructions": False,
    },
    {
        "id": "globalprotect",
        "name": "GlobalProtect Logs",
        "description": "VPN log analyzer for Mac and Windows endpoints",
        "category": "VPN",
        "icon": "network",
        "color": "#7b1fa2",
        "fields": [],
        "has_instructions": True,
        "instructions_label": "Analysis Instructions",
        "instructions_placeholder": "e.g., Flag repeated auth failures from the same user, highlight connections outside business hours (9am-6pm EST), focus on Windows endpoints, ignore service accounts matching svc-*...",
    },
    {
        "id": "threat_article",
        "name": "Threat Article",
        "description": "Automated IOC extraction and analysis from threat intel URLs",
        "category": "Threat Intel",
        "icon": "newspaper",
        "color": "#00838f",
        "fields": [],
        "has_instructions": True,
        "instructions_label": "Analysis Instructions",
        "instructions_placeholder": "e.g., Prioritize MITRE ATT&CK mappings, focus on ransomware IOCs, extract all C2 infrastructure, summarize for executive audience, link to relevant NIST controls...",
    },
]


def _get_connector_status(connector_id: str) -> str:
    settings = get_settings()
    configured_map = {
        "crowdstrike": bool(settings.crowdstrike_client_id and settings.crowdstrike_client_secret),
        "anthropic": bool(settings.anthropic_api_key),
        "virustotal": bool(settings.virustotal_api_key),
        "nist": True,
        "wildfire": bool(settings.wildfire_api_key),
        "palo_alto_scm": bool(settings.palo_alto_scm_client_id),
        "confluence": bool(settings.confluence_base_url and settings.confluence_api_token),
        "globalprotect": True,
        "threat_article": True,
    }
    return "connected" if configured_map.get(connector_id, False) else "unconfigured"


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/connectors")
async def get_connectors():
    result = []
    for defn in CONNECTOR_DEFINITIONS:
        cid = defn["id"]
        result.append({
            **defn,
            "status": _get_connector_status(cid),
            "instructions": _connector_instructions.get(cid, ""),
        })
    return result


@app.put("/api/connectors/{connector_id}/config")
async def update_connector_config(connector_id: str, config: dict):
    credentials = config.get("credentials", {})
    instructions = config.get("instructions", "")

    _connector_configs[connector_id] = credentials
    if instructions is not None:
        _connector_instructions[connector_id] = instructions
    _save_configs()

    settings_map = {
        "crowdstrike": {
            "crowdstrike_client_id": credentials.get("client_id", ""),
            "crowdstrike_client_secret": credentials.get("client_secret", ""),
            "crowdstrike_base_url": credentials.get("base_url", "https://api.crowdstrike.com"),
        },
        "anthropic": {
            "anthropic_api_key": credentials.get("api_key", ""),
            "claude_model": credentials.get("model", "claude-sonnet-4-6"),
        },
        "virustotal": {"virustotal_api_key": credentials.get("api_key", "")},
        "nist": {"nist_nvd_api_key": credentials.get("api_key", "")},
        "wildfire": {
            "wildfire_api_key": credentials.get("api_key", ""),
            "wildfire_base_url": credentials.get("base_url", "https://wildfire.paloaltonetworks.com"),
        },
        "palo_alto_scm": {
            "palo_alto_scm_client_id": credentials.get("client_id", ""),
            "palo_alto_scm_client_secret": credentials.get("client_secret", ""),
            "palo_alto_scm_tsg_id": credentials.get("tsg_id", ""),
            "palo_alto_scm_base_url": credentials.get("base_url", "https://api.sase.paloaltonetworks.com"),
        },
        "confluence": {
            "confluence_base_url": credentials.get("base_url", ""),
            "confluence_email": credentials.get("email", ""),
            "confluence_api_token": credentials.get("api_token", ""),
            "confluence_space_key": credentials.get("space_key", ""),
        },
    }

    if connector_id in settings_map:
        update_settings(**settings_map[connector_id])

    return {"status": "saved", "connector_id": connector_id}


@app.post("/api/connectors/{connector_id}/test")
async def test_connector(connector_id: str):
    settings = get_settings()
    try:
        if connector_id == "crowdstrike":
            from app.connectors import CrowdStrikeConnector
            c = CrowdStrikeConnector(settings.crowdstrike_client_id, settings.crowdstrike_client_secret, settings.crowdstrike_base_url)
            result = await c.test_connection()
        elif connector_id == "virustotal":
            from app.connectors import VirusTotalConnector
            c = VirusTotalConnector(settings.virustotal_api_key)
            result = await c.test_connection()
        elif connector_id == "nist":
            from app.connectors import NISTConnector
            c = NISTConnector(settings.nist_nvd_api_key)
            result = await c.test_connection()
        elif connector_id == "wildfire":
            from app.connectors import WildFireConnector
            c = WildFireConnector(settings.wildfire_api_key, settings.wildfire_base_url)
            result = await c.test_connection()
        elif connector_id == "confluence":
            from app.connectors import ConfluenceConnector
            c = ConfluenceConnector(settings.confluence_base_url, settings.confluence_email, settings.confluence_api_token, settings.confluence_space_key)
            result = await c.test_connection()
        elif connector_id == "palo_alto_scm":
            from app.connectors import PaloAltoSCMConnector
            c = PaloAltoSCMConnector(settings.palo_alto_scm_client_id, settings.palo_alto_scm_client_secret, settings.palo_alto_scm_tsg_id, settings.palo_alto_scm_base_url)
            result = await c.test_connection()
        elif connector_id in ("globalprotect", "threat_article", "anthropic"):
            result = {"status": "connected", "note": "No test endpoint required"}
        else:
            raise HTTPException(status_code=404, detail="Connector not found")
        return {"success": True, "result": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/upload/logs")
async def upload_log_file(file: UploadFile = File(...)):
    file_path = UPLOAD_DIR / file.filename
    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)
    return {"filename": file.filename, "size": len(content), "path": str(file_path)}


@app.get("/api/stats")
async def get_stats():
    settings = get_settings()
    configured = sum([
        bool(settings.crowdstrike_client_id),
        bool(settings.anthropic_api_key),
        bool(settings.virustotal_api_key),
        bool(settings.wildfire_api_key),
        bool(settings.confluence_base_url),
        bool(settings.palo_alto_scm_client_id),
        True,  # nist always available
        True,  # globalprotect always available
        True,  # threat_article always available
    ])
    return {
        "connectors_total": 9,
        "connectors_configured": configured,
        "connectors_active": configured,
        "model": settings.claude_model,
    }


@app.websocket("/ws/agent")
async def agent_websocket(websocket: WebSocket):
    await websocket.accept()
    settings = get_settings()
    agent = SecOpsAgent(settings)

    try:
        while True:
            data = await websocket.receive_json()
            messages = data.get("messages", [])
            if not messages:
                await websocket.send_json({"type": "error", "content": "No messages provided"})
                continue

            async for event in agent.run_streaming(messages, _connector_instructions):
                await websocket.send_json(event)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "content": str(e)})
        except Exception:
            pass
