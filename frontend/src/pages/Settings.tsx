import { useState } from "react";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Bot, Shield, Info, CheckCircle2 } from "lucide-react";

export default function Settings() {
  const [saved, setSaved] = useState(false);
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [maxTokens, setMaxTokens] = useState("8096");

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="p-8 max-w-2xl animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="w-5 h-5 text-cyan-400" />
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Settings</h1>
      </div>

      <div className="space-y-6">
        {/* AI Model */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl border border-white/6 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-6 py-4 border-b border-white/6">
            <Bot className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-sm text-slate-200">AI Configuration</span>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Claude Model</label>
              <select
                className="input-field"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="claude-opus-4-7">claude-opus-4-7 (Most capable)</option>
                <option value="claude-sonnet-4-6">claude-sonnet-4-6 (Recommended)</option>
                <option value="claude-haiku-4-5-20251001">claude-haiku-4-5 (Fastest)</option>
              </select>
              <p className="text-xs text-slate-600 mt-1.5">
                Sonnet offers the best balance of speed, capability, and cost for SecOps workloads.
              </p>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Max Output Tokens</label>
              <input
                type="number"
                className="input-field"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                min={1024}
                max={16000}
                step={512}
              />
            </div>
          </div>
        </motion.div>

        {/* Security */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="glass rounded-xl border border-white/6 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-6 py-4 border-b border-white/6">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-sm text-slate-200">Security</span>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-300">Credential Encryption</div>
                <div className="text-xs text-slate-500 mt-0.5">API keys stored in container volume</div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Enabled
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-300">TLS / HTTPS</div>
                <div className="text-xs text-slate-500 mt-0.5">Configure via reverse proxy (nginx/traefik)</div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <Info className="w-3.5 h-3.5" />
                Manual setup
              </div>
            </div>
          </div>
        </motion.div>

        {/* About */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="glass rounded-xl border border-white/6 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-white/6">
            <span className="font-semibold text-sm text-slate-200">About</span>
          </div>
          <div className="p-6 space-y-3 font-mono text-xs text-slate-500">
            {[
              ["Platform", "SecOps Agent v1.0"],
              ["Backend", "FastAPI + Anthropic SDK"],
              ["Frontend", "React + Tailwind CSS"],
              ["Container", "Docker Compose"],
              ["Agent Model", "Anthropic Claude"],
              ["Connectors", "9 integrations"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-600">{k}</span>
                <span className="text-slate-400">{v}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className={
              saved
                ? "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                : "btn-primary"
            }
          >
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Saved
              </>
            ) : (
              "Save Settings"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
