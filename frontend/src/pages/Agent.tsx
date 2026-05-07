import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Upload, Link, RotateCcw, ChevronDown,
  Wrench, Terminal, AlertCircle, Loader2, X, FileText,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import type { ChatMessage, AgentEvent } from "../types";

const API = import.meta.env.VITE_API_URL || "";
const WS_URL = API.replace(/^http/, "ws").replace(/^https/, "wss");

const QUICK_PROMPTS = [
  "Get the latest CrowdStrike detections and summarize threats",
  "Search NIST NVD for critical CVEs in the last 7 days",
  "Check this hash for malware: analyze with VirusTotal and WildFire",
  "Analyze recent Palo Alto SCM threat logs and identify top risks",
  "Search Confluence for our incident response runbook",
];

function ToolBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/25 text-purple-300 font-mono">
      <Wrench className="w-2.5 h-2.5" />
      {name.replace(/_/g, " ")}
    </span>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const isTool = msg.role === "tool";

  if (isTool) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-2 px-4 py-2"
      >
        <Terminal className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ToolBadge name={msg.tool_name || "tool"} />
            {msg.streaming && <Loader2 className="w-3 h-3 text-slate-500 animate-spin" />}
          </div>
          {msg.content && (
            <div className="text-xs text-slate-500 font-mono truncate">{msg.content}</div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx("flex gap-3 px-4 py-3", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/25">
          <Bot className="w-4 h-4 text-cyan-400" />
        </div>
      )}
      <div className={clsx("max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed", isUser
        ? "bg-cyan-500/15 border border-cyan-500/25 text-slate-200 rounded-tr-sm"
        : "glass border border-white/8 text-slate-200 rounded-tl-sm"
      )}>
        {isUser ? (
          <span>{msg.content}</span>
        ) : (
          <div className={clsx("prose prose-sm prose-invert max-w-none", msg.streaming && "typing-cursor")}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const isBlock = className?.includes("language-");
                  return isBlock ? (
                    <code className="block bg-surface-950 border border-white/8 rounded-lg p-3 text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className="bg-surface-950 border border-white/8 rounded px-1.5 py-0.5 text-xs font-mono text-cyan-300" {...props}>
                      {children}
                    </code>
                  );
                },
                p({ children }) {
                  return <p className="mb-2 last:mb-0 text-slate-200">{children}</p>;
                },
                ul({ children }) {
                  return <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>;
                },
                li({ children }) {
                  return <li className="text-slate-300">{children}</li>;
                },
                strong({ children }) {
                  return <strong className="text-slate-100 font-semibold">{children}</strong>;
                },
                h3({ children }) {
                  return <h3 className="text-slate-100 font-semibold mt-3 mb-1">{children}</h3>;
                },
                blockquote({ children }) {
                  return (
                    <blockquote className="border-l-2 border-cyan-500/40 pl-3 text-slate-400 italic">
                      {children}
                    </blockquote>
                  );
                },
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        )}
        <div className="text-right mt-1.5">
          <span className="text-xs text-slate-600 font-mono">
            {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10">
          <span className="text-xs font-bold text-slate-300">U</span>
        </div>
      )}
    </motion.div>
  );
}

export default function Agent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [logFile, setLogFile] = useState<File | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = useCallback((msg: Partial<ChatMessage> & { role: ChatMessage["role"]; content: string }) => {
    const full: ChatMessage = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...msg,
    };
    setMessages((prev) => [...prev, full]);
    return full.id;
  }, []);

  const updateMessage = useCallback((id: string, update: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...update } : m)));
  }, []);

  const send = useCallback(
    async (query: string) => {
      if (!query.trim() || isRunning) return;
      setInput("");
      setIsRunning(true);

      addMessage({ role: "user", content: query });

      const allMessages = [
        ...messages.filter((m) => m.role !== "tool"),
        { role: "user" as const, content: query },
      ].map((m) => ({ role: m.role, content: m.content }));

      let assistantId = "";
      let currentToolId = "";

      try {
        const wsUrl = `${WS_URL}/ws/agent`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ messages: allMessages }));
        };

        ws.onmessage = (evt) => {
          const event: AgentEvent = JSON.parse(evt.data);

          if (event.type === "text") {
            if (!assistantId) {
              assistantId = addMessage({ role: "assistant", content: event.content || "", streaming: true });
            } else {
              const chunk = event.content || "";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + chunk } : m
                )
              );
            }
          } else if (event.type === "tool_start") {
            currentToolId = addMessage({
              role: "tool",
              content: "",
              tool_name: event.tool_name,
              streaming: true,
            });
          } else if (event.type === "tool_executing") {
            updateMessage(currentToolId, {
              content: JSON.stringify(event.tool_input || {}).slice(0, 120),
              streaming: true,
            });
          } else if (event.type === "tool_result") {
            updateMessage(currentToolId, { streaming: false, content: `→ ${event.result?.slice(0, 80)}...` });
            currentToolId = "";
          } else if (event.type === "done") {
            if (assistantId) updateMessage(assistantId, { streaming: false });
            setIsRunning(false);
            ws.close();
          } else if (event.type === "error") {
            addMessage({ role: "assistant", content: `Error: ${event.content}` });
            setIsRunning(false);
            ws.close();
          }
        };

        ws.onerror = () => {
          addMessage({ role: "assistant", content: "WebSocket connection failed. Is the backend running?" });
          setIsRunning(false);
        };

        ws.onclose = () => {
          setIsRunning(false);
        };
      } catch (e) {
        addMessage({ role: "assistant", content: `Connection error: ${String(e)}` });
        setIsRunning(false);
      }
    },
    [isRunning, messages, addMessage, updateMessage, WS_URL]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleUploadLog = async () => {
    if (!logFile) return;
    const form = new FormData();
    form.append("file", logFile);
    const resp = await fetch(`${API}/api/upload/logs`, { method: "POST", body: form });
    const data = await resp.json();
    const content = await logFile.text();
    send(`Analyze these GlobalProtect VPN logs (${data.filename}, ${data.size} bytes):\n\n${content.slice(0, 6000)}`);
    setLogFile(null);
  };

  const reset = () => {
    wsRef.current?.close();
    setMessages([]);
    setIsRunning(false);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/6 glass">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="font-semibold text-sm text-slate-200">SecOps Agent</div>
            <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
              <span className="status-dot connected" />
              claude-sonnet-4-6 · tool_use enabled
            </div>
          </div>
        </div>
        {!isEmpty && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/4 border border-transparent hover:border-white/8"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New session
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto chat-scroll py-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-purple-500/15 border border-cyan-500/20 flex items-center justify-center mb-6">
              <Bot className="w-8 h-8 text-cyan-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-200 mb-2">SecOps AI Agent</h2>
            <p className="text-sm text-slate-500 max-w-sm mb-8 leading-relaxed">
              I can investigate threats, analyze logs, look up CVEs, scan IOCs, and search your knowledge base — all in one conversation.
            </p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-lg">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  className="text-left text-xs px-4 py-3 rounded-xl glass border border-white/6 hover:border-cyan-500/25 hover:bg-cyan-500/5 transition-all duration-150 text-slate-400 hover:text-slate-200"
                >
                  <ChevronDown className="w-3 h-3 inline mr-2 rotate-[-90deg] text-cyan-500" />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <AnimatePresence>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
            </AnimatePresence>
            {isRunning && !messages.some((m) => m.streaming) && (
              <div className="flex items-center gap-2 px-16 py-2">
                <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span className="text-xs text-slate-500">Agent thinking...</span>
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* URL input overlay */}
      <AnimatePresence>
        {showUrlInput && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="px-4 py-3 border-t border-white/6 bg-surface-800/60"
          >
            <div className="flex items-center gap-2">
              <input
                type="url"
                className="input-field flex-1 text-xs"
                placeholder="https://www.bleepingcomputer.com/..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    send(`Analyze this threat intelligence article and extract all IOCs, CVEs, MITRE TTPs, and provide a comprehensive security summary: ${urlInput}`);
                    setUrlInput("");
                    setShowUrlInput(false);
                  }
                }}
                autoFocus
              />
              <button
                onClick={() => {
                  if (urlInput) {
                    send(`Analyze this threat intelligence article and extract all IOCs, CVEs, MITRE TTPs, and provide a comprehensive security summary: ${urlInput}`);
                    setUrlInput("");
                  }
                  setShowUrlInput(false);
                }}
                className="btn-primary text-xs"
              >
                Analyze
              </button>
              <button onClick={() => setShowUrlInput(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1.5 pl-1">
              Paste a threat intel article URL — the agent will extract IOCs, CVEs, and MITRE TTPs
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log file upload area */}
      {logFile && (
        <div className="px-4 py-2 border-t border-white/6 flex items-center gap-2 bg-surface-800/40">
          <FileText className="w-4 h-4 text-purple-400" />
          <span className="text-xs text-slate-400 flex-1">{logFile.name}</span>
          <button onClick={handleUploadLog} className="btn-primary text-xs">
            Analyze Logs
          </button>
          <button onClick={() => setLogFile(null)} className="text-slate-500 hover:text-slate-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-4 border-t border-white/6 glass">
        <div className="flex items-end gap-3">
          {/* Attachments */}
          <div className="flex gap-1.5">
            <label
              className="flex items-center justify-center w-8 h-8 rounded-lg border border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/16 cursor-pointer transition-all"
              title="Upload log file"
            >
              <Upload className="w-3.5 h-3.5" />
              <input
                type="file"
                accept=".log,.txt,.csv"
                className="hidden"
                onChange={(e) => setLogFile(e.target.files?.[0] || null)}
              />
            </label>
            <button
              onClick={() => setShowUrlInput(!showUrlInput)}
              className={clsx(
                "flex items-center justify-center w-8 h-8 rounded-lg border transition-all",
                showUrlInput
                  ? "border-cyan-500/40 text-cyan-400 bg-cyan-500/10"
                  : "border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/16"
              )}
              title="Analyze threat article URL"
            >
              <Link className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              className="input-field resize-none leading-relaxed pr-12"
              style={{ minHeight: "44px", maxHeight: "140px" }}
              placeholder="Ask the agent... (e.g., 'Investigate hash d4e5f6... across all connectors')"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isRunning}
            />
          </div>

          {/* Send */}
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || isRunning}
            className={clsx(
              "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150",
              input.trim() && !isRunning
                ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 hover:shadow-[0_0_12px_rgba(0,212,255,0.3)]"
                : "bg-white/4 border border-white/8 text-slate-600"
            )}
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-2 pl-12">
          <span className="text-xs text-slate-600">Enter to send · Shift+Enter for newline</span>
          {isRunning && (
            <button
              onClick={() => { wsRef.current?.close(); setIsRunning(false); }}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3" /> Stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
