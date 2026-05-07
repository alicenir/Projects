import httpx
from bs4 import BeautifulSoup
import re
from typing import Any, Dict, List


CVE_RE = re.compile(r"CVE-\d{4}-\d{4,7}", re.IGNORECASE)
IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
DOMAIN_RE = re.compile(
    r"\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|net|org|io|gov|edu|co|uk|de|ru|cn|info|biz|tech|cloud|online)\b"
)
HASH_RE = re.compile(r"\b([a-fA-F0-9]{32}|[a-fA-F0-9]{40}|[a-fA-F0-9]{64})\b")
MITRE_RE = re.compile(r"T\d{4}(?:\.\d{3})?", re.IGNORECASE)


class ThreatArticleConnector:
    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
    }

    def __init__(self, instructions: str = ""):
        self.instructions = instructions

    async def fetch_article(self, url: str, custom_instructions: str = "") -> Dict[str, Any]:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            resp = await client.get(url, headers=self.HEADERS)
            resp.raise_for_status()
            html = resp.text

        soup = BeautifulSoup(html, "lxml")

        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
            tag.decompose()

        title = ""
        if soup.title:
            title = soup.title.string or ""
        if not title:
            h1 = soup.find("h1")
            title = h1.get_text(strip=True) if h1 else ""

        # Extract main content
        content_el = (
            soup.find("article")
            or soup.find("main")
            or soup.find(class_=re.compile(r"(content|article|post|entry|body)", re.I))
            or soup.body
        )
        raw_text = content_el.get_text(separator=" ", strip=True) if content_el else ""
        raw_text = re.sub(r"\s{2,}", " ", raw_text)

        cves = list({c.upper() for c in CVE_RE.findall(raw_text)})
        ips = list({ip for ip in IP_RE.findall(raw_text) if not ip.startswith(("10.", "192.168.", "172."))})
        domains = list({d.lower() for d in DOMAIN_RE.findall(raw_text) if len(d) > 5})[:30]
        hashes = list({h for h in HASH_RE.findall(raw_text)})
        mitre_ttps = list({t.upper() for t in MITRE_RE.findall(raw_text)})

        meta_desc = ""
        meta = soup.find("meta", attrs={"name": "description"})
        if meta and meta.get("content"):
            meta_desc = meta["content"]

        return {
            "url": url,
            "title": title.strip(),
            "meta_description": meta_desc,
            "text": raw_text[:8000],
            "indicators": {
                "cves": cves,
                "ips": ips[:20],
                "domains": domains,
                "hashes": hashes[:20],
                "mitre_ttps": mitre_ttps,
            },
            "custom_instructions": custom_instructions or self.instructions or None,
            "char_count": len(raw_text),
        }
