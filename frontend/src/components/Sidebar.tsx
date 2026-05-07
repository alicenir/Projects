import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Plug,
  Bot,
  Settings,
  Shield,
  Zap,
} from "lucide-react";
import clsx from "clsx";

const NAV = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/connectors", icon: Plug, label: "Connectors" },
  { to: "/agent", icon: Bot, label: "Agent" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  return (
    <aside className="w-64 flex flex-col glass border-r border-white/5 z-10">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 flex items-center justify-center">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 blur-sm" />
            <div className="relative rounded-xl border border-cyan-500/30 bg-surface-800 w-full h-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="font-bold text-sm text-slate-100 tracking-wide">SecOps Agent</div>
            <div className="text-xs text-slate-500 font-mono">v1.0 · AI Platform</div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="mx-4 mt-4 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        <span className="text-xs text-emerald-400 font-mono">Agent Online</span>
        <span className="ml-auto status-dot connected" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 mt-2">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}>
            {({ isActive }) => (
              <motion.div
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.98 }}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
                  isActive
                    ? "bg-cyan-500/10 border border-cyan-500/25 text-cyan-400"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/4 border border-transparent"
                )}
              >
                <Icon
                  className={clsx("w-4 h-4", isActive ? "text-cyan-400" : "text-slate-500")}
                />
                {label}
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400"
                    style={{ boxShadow: "0 0 6px #00d4ff" }}
                  />
                )}
              </motion.div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/5">
        <div className="text-xs text-slate-600 font-mono text-center">
          Powered by Claude Sonnet
        </div>
      </div>
    </aside>
  );
}
