export interface ConnectorField {
  key: string;
  label: string;
  type: "text" | "password" | "textarea" | "select";
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export interface Connector {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  fields: ConnectorField[];
  has_instructions: boolean;
  instructions_label?: string;
  instructions_placeholder?: string;
  status: "connected" | "unconfigured" | "error" | "testing";
  instructions?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_result?: string;
  timestamp: Date;
  streaming?: boolean;
}

export interface AgentEvent {
  type: "text" | "tool_start" | "tool_executing" | "tool_result" | "done" | "error";
  content?: string;
  tool_name?: string;
  tool_id?: string;
  tool_input?: Record<string, unknown>;
  result?: string;
}

export interface Stats {
  connectors_total: number;
  connectors_configured: number;
  connectors_active: number;
  model: string;
}
