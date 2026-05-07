from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from enum import Enum


class ConnectorStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    UNCONFIGURED = "unconfigured"


class ConnectorField(BaseModel):
    key: str
    label: str
    type: str = "text"  # text | password | textarea | select
    placeholder: str = ""
    required: bool = False
    options: Optional[List[str]] = None


class ConnectorDefinition(BaseModel):
    id: str
    name: str
    description: str
    category: str
    icon: str
    fields: List[ConnectorField]
    has_instructions: bool = False
    instructions_label: str = "Custom Instructions"
    instructions_placeholder: str = "Enter custom instructions..."


class ConnectorConfig(BaseModel):
    id: str
    credentials: Dict[str, str] = {}
    instructions: Optional[str] = None
    enabled: bool = True


class ConnectorState(BaseModel):
    id: str
    status: ConnectorStatus = ConnectorStatus.UNCONFIGURED
    last_tested: Optional[str] = None
    error_message: Optional[str] = None


class AnalysisRequest(BaseModel):
    query: str
    connectors: Optional[List[str]] = None
    context: Optional[str] = None


class AgentMessage(BaseModel):
    role: str  # user | assistant | tool
    content: str
    tool_name: Optional[str] = None
    tool_input: Optional[Dict] = None
    timestamp: Optional[str] = None


class ThreatArticleRequest(BaseModel):
    url: str
    instructions: Optional[str] = None


class LogAnalysisRequest(BaseModel):
    log_content: str
    platform: str = "auto"  # mac | windows | auto
    instructions: Optional[str] = None


class SettingsUpdate(BaseModel):
    key: str
    value: str


class TestConnectionRequest(BaseModel):
    connector_id: str
