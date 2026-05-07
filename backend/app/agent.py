import json
from typing import Any, AsyncGenerator, Dict, List, Optional
import anthropic
from app.config import Settings


SYSTEM_PROMPT = """You are an elite SecOps AI agent orchestrating a comprehensive security operations platform. You have access to multiple security tools and connectors. Your role is to:

1. Analyze security threats, incidents, and intelligence with precision and depth
2. Correlate data across multiple sources (CrowdStrike, VirusTotal, NIST NVD, WildFire, Palo Alto SCM, GlobalProtect, Confluence, Threat Articles)
3. Provide actionable, prioritized recommendations with MITRE ATT&CK mappings when relevant
4. Present findings clearly with severity assessments (CRITICAL/HIGH/MEDIUM/LOW/INFO)
5. Think like a threat hunter — look for patterns, lateral movement, persistence, and IOCs

Always structure your responses with:
- Executive Summary (2-3 sentences)
- Key Findings (bulleted, prioritized by severity)
- Detailed Analysis (with evidence)
- Recommended Actions (prioritized, specific)
- IOC Summary (if applicable)

Be concise but thorough. When you don't have access to a tool or it returns an error, acknowledge it and work with available data."""


TOOLS: List[Dict[str, Any]] = [
    {
        "name": "crowdstrike_get_detections",
        "description": "Get recent threat detections from CrowdStrike endpoint protection. Returns detected threats, severity, tactics, and affected hosts.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Number of detections to retrieve (default 10, max 50)", "default": 10}
            },
        },
    },
    {
        "name": "crowdstrike_get_incidents",
        "description": "Get recent security incidents from CrowdStrike. Returns incident details, status, and severity.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Number of incidents to retrieve", "default": 10}
            },
        },
    },
    {
        "name": "crowdstrike_search_ioc",
        "description": "Search CrowdStrike threat intelligence for a specific indicator of compromise (IP, domain, hash, URL).",
        "input_schema": {
            "type": "object",
            "properties": {
                "ioc": {"type": "string", "description": "The indicator to search for (IP address, domain, file hash, or URL)"}
            },
            "required": ["ioc"],
        },
    },
    {
        "name": "virustotal_scan_hash",
        "description": "Scan a file hash (MD5, SHA1, or SHA256) against 70+ antivirus engines via VirusTotal.",
        "input_schema": {
            "type": "object",
            "properties": {
                "hash": {"type": "string", "description": "The file hash to scan (MD5, SHA1, or SHA256)"}
            },
            "required": ["hash"],
        },
    },
    {
        "name": "virustotal_scan_url",
        "description": "Scan a URL for malware, phishing, or other threats via VirusTotal.",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "The URL to scan"}
            },
            "required": ["url"],
        },
    },
    {
        "name": "virustotal_scan_ip",
        "description": "Check reputation and threat intelligence for an IP address via VirusTotal.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ip": {"type": "string", "description": "The IP address to check"}
            },
            "required": ["ip"],
        },
    },
    {
        "name": "virustotal_scan_domain",
        "description": "Check reputation and threat intelligence for a domain via VirusTotal.",
        "input_schema": {
            "type": "object",
            "properties": {
                "domain": {"type": "string", "description": "The domain to check"}
            },
            "required": ["domain"],
        },
    },
    {
        "name": "nist_get_cve",
        "description": "Look up detailed information about a specific CVE from the NIST National Vulnerability Database.",
        "input_schema": {
            "type": "object",
            "properties": {
                "cve_id": {"type": "string", "description": "The CVE identifier (e.g., CVE-2024-1234)"}
            },
            "required": ["cve_id"],
        },
    },
    {
        "name": "nist_search_cves",
        "description": "Search NIST NVD for CVEs by keyword or severity filter.",
        "input_schema": {
            "type": "object",
            "properties": {
                "keyword": {"type": "string", "description": "Search keyword (product name, vendor, etc.)"},
                "severity": {"type": "string", "description": "Filter by severity: CRITICAL, HIGH, MEDIUM, LOW"},
                "limit": {"type": "integer", "description": "Number of results", "default": 10},
            },
        },
    },
    {
        "name": "wildfire_get_verdict",
        "description": "Get WildFire malware analysis verdict for a file hash.",
        "input_schema": {
            "type": "object",
            "properties": {
                "hash": {"type": "string", "description": "The file hash (MD5 or SHA256)"}
            },
            "required": ["hash"],
        },
    },
    {
        "name": "wildfire_submit_url",
        "description": "Submit a URL to Palo Alto WildFire for malware analysis.",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "The URL to submit for analysis"}
            },
            "required": ["url"],
        },
    },
    {
        "name": "confluence_search",
        "description": "Search the organizational Confluence knowledge base for security policies, runbooks, and incident documentation.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query text"},
                "limit": {"type": "integer", "description": "Number of results", "default": 5},
            },
            "required": ["query"],
        },
    },
    {
        "name": "palo_alto_scm_get_threats",
        "description": "Retrieve security threat events from Palo Alto Strata Cloud Manager log management.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Number of events to retrieve", "default": 50},
                "severity": {"type": "string", "description": "Filter by severity level"},
            },
        },
    },
    {
        "name": "palo_alto_scm_get_traffic",
        "description": "Retrieve traffic logs from Palo Alto SCM for network analysis.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Number of log entries", "default": 50},
                "src_ip": {"type": "string", "description": "Filter by source IP"},
                "dst_ip": {"type": "string", "description": "Filter by destination IP"},
            },
        },
    },
    {
        "name": "analyze_threat_article",
        "description": "Fetch and analyze a threat intelligence article from a URL, extracting IOCs, CVEs, MITRE TTPs, and key findings.",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL of the threat intelligence article"},
                "custom_instructions": {"type": "string", "description": "Optional specific analysis instructions"},
            },
            "required": ["url"],
        },
    },
    {
        "name": "analyze_globalprotect_logs",
        "description": "Analyze GlobalProtect VPN logs (Mac or Windows) to identify authentication failures, anomalies, and security issues.",
        "input_schema": {
            "type": "object",
            "properties": {
                "log_content": {"type": "string", "description": "The raw log content to analyze"},
                "platform": {"type": "string", "description": "Platform: mac, windows, or auto", "default": "auto"},
                "custom_instructions": {"type": "string", "description": "Optional specific analysis instructions"},
            },
            "required": ["log_content"],
        },
    },
]


class SecOpsAgent:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._connectors: Dict[str, Any] = {}

    def _get_connector(self, name: str) -> Optional[Any]:
        if name not in self._connectors:
            cfg = self._connector_configs.get(name, {})
            self._init_connector(name, cfg)
        return self._connectors.get(name)

    def configure_connectors(self, configs: Dict[str, Dict]) -> None:
        self._connector_configs = configs

    def _init_connectors_from_settings(self) -> None:
        from app.connectors import (
            CrowdStrikeConnector,
            VirusTotalConnector,
            NISTConnector,
            WildFireConnector,
            ConfluenceConnector,
            PaloAltoSCMConnector,
            GlobalProtectConnector,
            ThreatArticleConnector,
        )
        s = self.settings
        self._connectors = {}
        if s.crowdstrike_client_id:
            self._connectors["crowdstrike"] = CrowdStrikeConnector(
                s.crowdstrike_client_id, s.crowdstrike_client_secret, s.crowdstrike_base_url
            )
        if s.virustotal_api_key:
            self._connectors["virustotal"] = VirusTotalConnector(s.virustotal_api_key)
        self._connectors["nist"] = NISTConnector(s.nist_nvd_api_key)
        if s.wildfire_api_key:
            self._connectors["wildfire"] = WildFireConnector(s.wildfire_api_key, s.wildfire_base_url)
        if s.confluence_base_url and s.confluence_api_token:
            self._connectors["confluence"] = ConfluenceConnector(
                s.confluence_base_url, s.confluence_email, s.confluence_api_token, s.confluence_space_key
            )
        if s.palo_alto_scm_client_id:
            self._connectors["palo_alto_scm"] = PaloAltoSCMConnector(
                s.palo_alto_scm_client_id, s.palo_alto_scm_client_secret,
                s.palo_alto_scm_tsg_id, s.palo_alto_scm_base_url,
            )
        self._connectors["globalprotect"] = GlobalProtectConnector()
        self._connectors["threat_article"] = ThreatArticleConnector()

    async def _execute_tool(self, tool_name: str, tool_input: Dict) -> str:
        try:
            cs = self._connectors.get("crowdstrike")
            vt = self._connectors.get("virustotal")
            nist = self._connectors.get("nist")
            wf = self._connectors.get("wildfire")
            conf = self._connectors.get("confluence")
            scm = self._connectors.get("palo_alto_scm")
            gp = self._connectors.get("globalprotect")
            ta = self._connectors.get("threat_article")

            if tool_name == "crowdstrike_get_detections":
                if not cs:
                    return json.dumps({"error": "CrowdStrike not configured"})
                result = await cs.get_detections(tool_input.get("limit", 10))
                return json.dumps(result, default=str)

            elif tool_name == "crowdstrike_get_incidents":
                if not cs:
                    return json.dumps({"error": "CrowdStrike not configured"})
                result = await cs.get_incidents(tool_input.get("limit", 10))
                return json.dumps(result, default=str)

            elif tool_name == "crowdstrike_search_ioc":
                if not cs:
                    return json.dumps({"error": "CrowdStrike not configured"})
                result = await cs.search_indicators(tool_input["ioc"])
                return json.dumps(result, default=str)

            elif tool_name == "virustotal_scan_hash":
                if not vt:
                    return json.dumps({"error": "VirusTotal not configured"})
                result = await vt.scan_file_hash(tool_input["hash"])
                return json.dumps(result, default=str)

            elif tool_name == "virustotal_scan_url":
                if not vt:
                    return json.dumps({"error": "VirusTotal not configured"})
                result = await vt.scan_url(tool_input["url"])
                return json.dumps(result, default=str)

            elif tool_name == "virustotal_scan_ip":
                if not vt:
                    return json.dumps({"error": "VirusTotal not configured"})
                result = await vt.scan_ip(tool_input["ip"])
                return json.dumps(result, default=str)

            elif tool_name == "virustotal_scan_domain":
                if not vt:
                    return json.dumps({"error": "VirusTotal not configured"})
                result = await vt.scan_domain(tool_input["domain"])
                return json.dumps(result, default=str)

            elif tool_name == "nist_get_cve":
                if not nist:
                    return json.dumps({"error": "NIST not available"})
                result = await nist.get_cve(tool_input["cve_id"])
                return json.dumps(result, default=str)

            elif tool_name == "nist_search_cves":
                if not nist:
                    return json.dumps({"error": "NIST not available"})
                result = await nist.search_cves(
                    keyword=tool_input.get("keyword", ""),
                    severity=tool_input.get("severity", ""),
                    limit=tool_input.get("limit", 10),
                )
                return json.dumps(result, default=str)

            elif tool_name == "wildfire_get_verdict":
                if not wf:
                    return json.dumps({"error": "WildFire not configured"})
                result = await wf.get_verdict(tool_input["hash"])
                return json.dumps(result, default=str)

            elif tool_name == "wildfire_submit_url":
                if not wf:
                    return json.dumps({"error": "WildFire not configured"})
                result = await wf.submit_url(tool_input["url"])
                return json.dumps(result, default=str)

            elif tool_name == "confluence_search":
                if not conf:
                    return json.dumps({"error": "Confluence not configured"})
                result = await conf.search_content(tool_input["query"], tool_input.get("limit", 5))
                return json.dumps(result, default=str)

            elif tool_name == "palo_alto_scm_get_threats":
                if not scm:
                    return json.dumps({"error": "Palo Alto SCM not configured"})
                result = await scm.get_security_events(
                    tool_input.get("limit", 50), tool_input.get("severity", "")
                )
                return json.dumps(result, default=str)

            elif tool_name == "palo_alto_scm_get_traffic":
                if not scm:
                    return json.dumps({"error": "Palo Alto SCM not configured"})
                result = await scm.get_traffic_logs(
                    tool_input.get("limit", 50),
                    tool_input.get("src_ip", ""),
                    tool_input.get("dst_ip", ""),
                )
                return json.dumps(result, default=str)

            elif tool_name == "analyze_threat_article":
                if not ta:
                    return json.dumps({"error": "Threat Article connector unavailable"})
                result = await ta.fetch_article(
                    tool_input["url"], tool_input.get("custom_instructions", "")
                )
                return json.dumps(result, default=str)

            elif tool_name == "analyze_globalprotect_logs":
                if not gp:
                    return json.dumps({"error": "GlobalProtect connector unavailable"})
                result = gp.analyze_logs(
                    tool_input["log_content"],
                    tool_input.get("platform", "auto"),
                    tool_input.get("custom_instructions", ""),
                )
                return json.dumps(result, default=str)

            return json.dumps({"error": f"Unknown tool: {tool_name}"})

        except Exception as e:
            return json.dumps({"error": str(e)})

    async def run_streaming(
        self,
        messages: List[Dict],
        connector_configs: Optional[Dict] = None,
    ) -> AsyncGenerator[Dict, None]:
        self._connector_configs = connector_configs or {}
        self._init_connectors_from_settings()

        client = anthropic.AsyncAnthropic(api_key=self.settings.anthropic_api_key)
        current_messages = list(messages)

        while True:
            full_text = ""
            tool_uses = []
            stop_reason = None

            async with client.messages.stream(
                model=self.settings.claude_model,
                max_tokens=8096,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=current_messages,
            ) as stream:
                async for event in stream:
                    if hasattr(event, "type"):
                        if event.type == "content_block_start":
                            block = event.content_block
                            if block.type == "tool_use":
                                tool_uses.append({
                                    "id": block.id,
                                    "name": block.name,
                                    "input": {},
                                    "_raw_input": "",
                                })
                                yield {
                                    "type": "tool_start",
                                    "tool_name": block.name,
                                    "tool_id": block.id,
                                }
                        elif event.type == "content_block_delta":
                            delta = event.delta
                            if delta.type == "text_delta":
                                full_text += delta.text
                                yield {"type": "text", "content": delta.text}
                            elif delta.type == "input_json_delta":
                                if tool_uses:
                                    tool_uses[-1]["_raw_input"] += delta.partial_json
                        elif event.type == "content_block_stop":
                            if tool_uses and tool_uses[-1]["_raw_input"]:
                                try:
                                    tool_uses[-1]["input"] = json.loads(tool_uses[-1]["_raw_input"])
                                except json.JSONDecodeError:
                                    pass
                        elif event.type == "message_delta":
                            stop_reason = event.delta.stop_reason

            if stop_reason == "end_turn" or not tool_uses:
                yield {"type": "done"}
                break

            if stop_reason == "tool_use" and tool_uses:
                assistant_content = []
                if full_text:
                    assistant_content.append({"type": "text", "text": full_text})
                for tu in tool_uses:
                    assistant_content.append({
                        "type": "tool_use",
                        "id": tu["id"],
                        "name": tu["name"],
                        "input": tu["input"],
                    })
                current_messages.append({"role": "assistant", "content": assistant_content})

                tool_results = []
                for tu in tool_uses:
                    yield {
                        "type": "tool_executing",
                        "tool_name": tu["name"],
                        "tool_input": tu["input"],
                    }
                    result = await self._execute_tool(tu["name"], tu["input"])
                    yield {
                        "type": "tool_result",
                        "tool_name": tu["name"],
                        "tool_id": tu["id"],
                        "result": result[:500],
                    }
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tu["id"],
                        "content": result,
                    })

                current_messages.append({"role": "user", "content": tool_results})
            else:
                yield {"type": "done"}
                break
