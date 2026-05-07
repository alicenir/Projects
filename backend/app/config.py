from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Anthropic
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-6"

    # CrowdStrike
    crowdstrike_client_id: str = ""
    crowdstrike_client_secret: str = ""
    crowdstrike_base_url: str = "https://api.crowdstrike.com"

    # VirusTotal
    virustotal_api_key: str = ""

    # NIST NVD
    nist_nvd_api_key: str = ""

    # WildFire
    wildfire_api_key: str = ""
    wildfire_base_url: str = "https://wildfire.paloaltonetworks.com"

    # Palo Alto SCM
    palo_alto_scm_client_id: str = ""
    palo_alto_scm_client_secret: str = ""
    palo_alto_scm_tsg_id: str = ""
    palo_alto_scm_base_url: str = "https://api.sase.paloaltonetworks.com"

    # Confluence
    confluence_base_url: str = ""
    confluence_email: str = ""
    confluence_api_token: str = ""
    confluence_space_key: str = ""

    # App
    secret_key: str = "change-me"
    environment: str = "development"

    class Config:
        env_file = ".env"
        extra = "ignore"


_settings: Optional[Settings] = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def update_settings(**kwargs) -> Settings:
    global _settings
    current = get_settings()
    data = current.model_dump()
    data.update(kwargs)
    _settings = Settings(**data)
    return _settings
