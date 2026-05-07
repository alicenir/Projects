import re
from datetime import datetime
from typing import Any, Dict, List, Optional


MAC_PATTERNS = {
    "connection_attempt": re.compile(
        r"(?P<timestamp>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+.*?(?:connect|connecting)\s+(?:to\s+)?(?P<gateway>\S+)",
        re.IGNORECASE,
    ),
    "auth_failure": re.compile(
        r"(?P<timestamp>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+.*?(?:authentication\s+failed|auth\s+error|login\s+failed)",
        re.IGNORECASE,
    ),
    "tunnel_established": re.compile(
        r"(?P<timestamp>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+.*?(?:tunnel\s+established|connected\s+successfully|vpn\s+connected)",
        re.IGNORECASE,
    ),
    "disconnected": re.compile(
        r"(?P<timestamp>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+.*?(?:disconnected|tunnel\s+closed|connection\s+lost)",
        re.IGNORECASE,
    ),
    "gateway_ip": re.compile(r"gateway[:\s]+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})", re.IGNORECASE),
}

WINDOWS_PATTERNS = {
    "connection_attempt": re.compile(
        r"(?P<timestamp>\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+(?:AM|PM))\s+.*?(?:connect|connecting)\s+(?:to\s+)?(?P<gateway>\S+)",
        re.IGNORECASE,
    ),
    "auth_failure": re.compile(
        r"(?P<timestamp>\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+(?:AM|PM))\s+.*?(?:authentication\s+failed|auth\s+error)",
        re.IGNORECASE,
    ),
    "tunnel_established": re.compile(
        r"(?P<timestamp>\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+(?:AM|PM))\s+.*?(?:tunnel\s+established|connected\s+successfully)",
        re.IGNORECASE,
    ),
    "error": re.compile(
        r"(?P<timestamp>\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+(?:AM|PM))\s+.*?(?:error|failed|failure)",
        re.IGNORECASE,
    ),
}

IP_PATTERN = re.compile(r"\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b")
USER_PATTERN = re.compile(r"(?:user[:\s]+|username[:\s]+)([a-zA-Z0-9._@-]+)", re.IGNORECASE)


class GlobalProtectConnector:
    def __init__(self, instructions: str = ""):
        self.instructions = instructions

    def _detect_platform(self, log_content: str) -> str:
        if re.search(r"\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+(AM|PM)", log_content):
            return "windows"
        if re.search(r"\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}", log_content):
            return "mac"
        return "unknown"

    def analyze_logs(
        self,
        log_content: str,
        platform: str = "auto",
        custom_instructions: str = "",
    ) -> Dict[str, Any]:
        if platform == "auto":
            platform = self._detect_platform(log_content)

        patterns = MAC_PATTERNS if platform != "windows" else WINDOWS_PATTERNS
        lines = log_content.splitlines()
        events: List[Dict[str, Any]] = []
        stats = {
            "total_lines": len(lines),
            "connection_attempts": 0,
            "auth_failures": 0,
            "tunnels_established": 0,
            "disconnections": 0,
            "errors": 0,
        }

        ips = set(IP_PATTERN.findall(log_content))
        users = set(USER_PATTERN.findall(log_content))

        for line in lines:
            for event_type, pattern in patterns.items():
                m = pattern.search(line)
                if m:
                    event: Dict[str, Any] = {
                        "type": event_type,
                        "timestamp": m.group("timestamp") if "timestamp" in pattern.groupindex else "",
                        "raw": line[:200],
                    }
                    if "gateway" in pattern.groupindex:
                        try:
                            event["gateway"] = m.group("gateway")
                        except IndexError:
                            pass
                    events.append(event)
                    key = event_type if event_type in stats else "errors"
                    stats[key] = stats.get(key, 0) + 1
                    break

        anomalies = []
        if stats["auth_failures"] > 5:
            anomalies.append(f"High auth failure count: {stats['auth_failures']} failures detected")
        if stats["connection_attempts"] > 0 and stats["tunnels_established"] == 0:
            anomalies.append("Connection attempts with no successful tunnels — possible gateway unreachability")
        if stats["disconnections"] > stats["tunnels_established"] * 2:
            anomalies.append("Excessive disconnections relative to connections — possible stability issue")

        return {
            "platform": platform,
            "statistics": stats,
            "events": events[:100],
            "observed_ips": list(ips)[:20],
            "observed_users": list(users)[:20],
            "anomalies": anomalies,
            "instructions_applied": custom_instructions or self.instructions or None,
        }
