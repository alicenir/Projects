import { motion } from "framer-motion";
import {
  ShieldCheck, Brain, ScanLine, Database, Flame,
  Activity, BookOpen, Network, Newspaper, Plug,
  CheckCircle2, AlertCircle, Settings2, TestTube2,
} from "lucide-react";
import clsx from "clsx";
import type { Connector } from "../types";

const ICON_MAP: Record<string, React.ElementType> = {
  "shield-check": ShieldCheck,
  "brain": Brain,
  "scan-line": ScanLine,
  "database": Database,
  "flame": Flame,
  "activity": Activity,
  "book-open": BookOpen,
  "network": Network,
  "newspaper": Newspaper,
};

interface Props {
  connector: Connector;
  onConfigure: (connector: Connector) => void;
  onTest: (connectorId: string) => Promise<void>;
  testing?: boolean;
}

export default function ConnectorCard({ connector, onConfigure, onTest, testing }: Props) {
  const Icon = ICON_MAP[connector.icon] || Plug;
  const isConnected = connector.status === "connected";
  const isUnconfigured = connector.status === "unconfigured";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={clsx(
        "relative rounded-xl border transition-all duration-200 overflow-hidden group cursor-default",
        isConnected
          ? "border-emerald-500/20 bg-gradient-to-br from-surface-800 to-surface-900"
          : "border-white/6 bg-surface-800/60"
      )}
    >
      {/* Top color bar */}
      <div
        className="h-0.5 w-full opacity-60"
        style={{ background: `linear-gradient(90deg, ${connector.color}, transparent)` }}
      />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
              style={{
                background: `linear-gradient(135deg, ${connector.color}22, ${connector.color}11)`,
                border: `1px solid ${connector.color}33`,
              }}
            >
              <Icon className="w-5 h-5" style={{ color: connector.color }} />
            </div>
            <div>
              <div className="font-semibold text-slate-100 text-sm">{connector.name}</div>
              <div className="text-xs text-slate-500 font-mono">{connector.category}</div>
            </div>
          </div>

          {/* Status badge */}
          <div className={clsx(
            "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium",
            isConnected
              ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
              : "bg-slate-500/10 border border-slate-500/20 text-slate-500"
          )}>
            {isConnected ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <AlertCircle className="w-3 h-3" />
            )}
            {isConnected ? "Connected" : "Not configured"}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          {connector.description}
        </p>

        {/* Instructions preview */}
        {connector.has_instructions && connector.instructions && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-surface-950/60 border border-white/5">
            <div className="text-xs text-slate-500 mb-1">Custom instructions</div>
            <div className="text-xs text-slate-400 truncate font-mono">
              {connector.instructions}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onConfigure(connector)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-150 font-medium text-slate-300 bg-white/4 border border-white/8 hover:bg-white/8 hover:border-white/16 flex-1 justify-center"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Configure
          </button>
          {connector.fields.length > 0 && isConnected && (
            <button
              onClick={() => onTest(connector.id)}
              disabled={testing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-150 font-medium border border-cyan-500/25 text-cyan-400 bg-cyan-500/8 hover:bg-cyan-500/15 disabled:opacity-40"
            >
              <TestTube2 className={clsx("w-3.5 h-3.5", testing && "animate-spin")} />
              Test
            </button>
          )}
        </div>
      </div>

      {/* Connected glow effect */}
      {isConnected && (
        <div
          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
          style={{
            background: `radial-gradient(ellipse at top left, ${connector.color}08, transparent 70%)`,
          }}
        />
      )}
    </motion.div>
  );
}
