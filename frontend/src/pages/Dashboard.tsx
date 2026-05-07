import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Shield, Activity, AlertTriangle, CheckCircle2,
  TrendingUp, ArrowRight, Zap, Globe, Bot,
} from "lucide-react";
import clsx from "clsx";
import type { Connector, Stats } from "../types";

const API = import.meta.env.VITE_API_URL || "";

const THREAT_FEED = [
  { id: 1, type: "CRITICAL", msg: "CrowdStrike detection — LSASS credential dumping (T1003.001)", time: "2m ago", color: "red" },
  { id: 2, type: "HIGH", msg: "VirusTotal: 42/72 engines flag hash 3a4b5c... as Trojan.GenericKD", time: "7m ago", color: "orange" },
  { id: 3, type: "HIGH", msg: "NIST NVD: CVE-2024-38812 (CVSS 9.8) active exploit in the wild", time: "15m ago", color: "orange" },
  { id: 4, type: "MEDIUM", msg: "GlobalProtect: 14 auth failures for user jsmith from 185.220.x.x", time: "23m ago", color: "yellow" },
  { id: 5, type: "MEDIUM", msg: "WildFire verdict MALWARE for submitted PDF — macros detected", time: "41m ago", color: "yellow" },
  { id: 6, type: "LOW", msg: "Palo Alto SCM: Unusual outbound port 4444 to 91.196.x.x blocked", time: "1h ago", color: "green" },
];

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "tag-severity-critical",
  HIGH: "tag-severity-high",
  MEDIUM: "tag-severity-medium",
  LOW: "tag-severity-low",
};

export default function Dashboard() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch(`${API}/api/connectors`).then((r) => r.json()).then(setConnectors).catch(() => {});
    fetch(`${API}/api/stats`).then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  const configured = connectors.filter((c) => c.status === "connected").length;
  const total = connectors.length;

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Security Operations Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            AI-orchestrated threat detection and response platform
          </p>
        </div>
        <Link
          to="/agent"
          className="btn-primary flex items-center gap-2"
        >
          <Bot className="w-4 h-4" />
          Launch Agent
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            icon: Shield,
            label: "Connectors Active",
            value: `${configured}/${total}`,
            sub: "integrations online",
            color: "cyan",
            glow: "rgba(0,212,255,0.15)",
          },
          {
            icon: AlertTriangle,
            label: "Active Threats",
            value: "3",
            sub: "requires attention",
            color: "red",
            glow: "rgba(239,68,68,0.15)",
          },
          {
            icon: Activity,
            label: "Events Today",
            value: "1,247",
            sub: "across all connectors",
            color: "purple",
            glow: "rgba(159,122,234,0.15)",
          },
          {
            icon: CheckCircle2,
            label: "Resolved",
            value: "98.2%",
            sub: "detection rate",
            color: "green",
            glow: "rgba(0,255,136,0.15)",
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="glass rounded-xl p-5 border border-white/6 relative overflow-hidden"
            style={{ boxShadow: `0 0 30px ${card.glow}` }}
          >
            <div className="flex items-start justify-between mb-3">
              <card.icon
                className={clsx(
                  "w-5 h-5",
                  card.color === "cyan" && "text-cyan-400",
                  card.color === "red" && "text-red-400",
                  card.color === "purple" && "text-purple-400",
                  card.color === "green" && "text-emerald-400",
                )}
              />
              <TrendingUp className="w-3.5 h-3.5 text-slate-600" />
            </div>
            <div className="text-2xl font-bold text-slate-100 font-mono tracking-tight">
              {card.value}
            </div>
            <div className="text-xs font-medium text-slate-300 mt-0.5">{card.label}</div>
            <div className="text-xs text-slate-600 mt-0.5">{card.sub}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Threat Feed */}
        <div className="col-span-2 glass rounded-xl border border-white/6 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-sm text-slate-200">Live Threat Feed</span>
            </div>
            <span className="text-xs text-slate-500 font-mono">Last 2h</span>
          </div>
          <div className="divide-y divide-white/4">
            {THREAT_FEED.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }}
                className="px-5 py-3.5 flex items-start gap-3 hover:bg-white/2 transition-colors"
              >
                <span className={SEVERITY_COLORS[item.type]}>{item.type}</span>
                <span className="text-xs text-slate-300 flex-1 leading-relaxed">{item.msg}</span>
                <span className="text-xs text-slate-600 font-mono flex-shrink-0 mt-0.5">{item.time}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Connector status panel */}
        <div className="glass rounded-xl border border-white/6 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/6">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-sm text-slate-200">Connector Status</span>
          </div>
          <div className="p-4 space-y-2">
            {connectors.slice(0, 9).map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/3 transition-colors"
              >
                <span
                  className={clsx("status-dot", c.status === "connected" ? "connected" : "unconfigured")}
                />
                <span className="text-xs text-slate-300 flex-1 truncate">{c.name}</span>
                <span className="text-xs font-mono text-slate-600">{c.category}</span>
              </motion.div>
            ))}
            {connectors.length === 0 && (
              <div className="text-xs text-slate-600 text-center py-4">Loading...</div>
            )}
          </div>
          <div className="px-4 pb-4">
            <Link
              to="/connectors"
              className="flex items-center justify-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors py-2 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/5"
            >
              Manage connectors <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* AI Status bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-xl border border-cyan-500/15 p-4"
        style={{ boxShadow: "0 0 20px rgba(0,212,255,0.05)" }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-slate-300">AI Agent Ready</span>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            Model: {stats?.model || "claude-sonnet-4-6"}
          </div>
          <div className="text-xs text-slate-500">·</div>
          <div className="text-xs text-slate-500">
            {stats?.connectors_configured || 0} connectors available
          </div>
          <Link
            to="/agent"
            className="ml-auto btn-primary text-xs flex items-center gap-1.5"
          >
            Start Investigation <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
