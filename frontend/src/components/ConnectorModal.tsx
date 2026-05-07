import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff, Save, TestTube2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import clsx from "clsx";
import type { Connector } from "../types";

interface Props {
  connector: Connector | null;
  onClose: () => void;
  onSave: (connectorId: string, credentials: Record<string, string>, instructions: string) => Promise<void>;
  onTest: (connectorId: string) => Promise<{ success: boolean; error?: string; result?: unknown }>;
}

export default function ConnectorModal({ connector, onClose, onSave, onTest }: Props) {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [instructions, setInstructions] = useState("");
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!connector) return;
    setCredentials({});
    setInstructions(connector.instructions || "");
    setShowPasswords({});
    setTestResult(null);
  }, [connector]);

  if (!connector) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(connector.id, credentials, instructions);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(connector.id);
      setTestResult({
        success: result.success,
        message: result.success
          ? "Connection successful"
          : result.error || "Connection failed",
      });
    } finally {
      setTesting(false);
    }
  };

  const togglePassword = (key: string) => {
    setShowPasswords((p) => ({ ...p, [key]: !p[key] }));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg glass rounded-2xl border border-white/10 shadow-2xl"
          style={{ boxShadow: `0 0 60px rgba(0,0,0,0.8), 0 0 30px ${connector.color}15` }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-6 border-b border-white/8">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${connector.color}22, ${connector.color}11)`,
                border: `1px solid ${connector.color}33`,
              }}
            >
              <span className="text-sm font-bold" style={{ color: connector.color }}>
                {connector.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="font-semibold text-slate-100">{connector.name}</h2>
              <p className="text-xs text-slate-500">{connector.category} connector</p>
            </div>
            <button
              onClick={onClose}
              className="ml-auto text-slate-500 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Credential fields */}
            {connector.fields.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider font-medium">
                  <span>Credentials</span>
                </div>
                {connector.fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs text-slate-400 mb-1.5">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    {field.type === "textarea" ? (
                      <textarea
                        className="textarea-field"
                        placeholder={field.placeholder || ""}
                        value={credentials[field.key] || ""}
                        onChange={(e) => setCredentials((p) => ({ ...p, [field.key]: e.target.value }))}
                      />
                    ) : field.type === "password" ? (
                      <div className="relative">
                        <input
                          type={showPasswords[field.key] ? "text" : "password"}
                          className="input-field pr-9"
                          placeholder={field.placeholder || "••••••••••••"}
                          value={credentials[field.key] || ""}
                          onChange={(e) => setCredentials((p) => ({ ...p, [field.key]: e.target.value }))}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                          onClick={() => togglePassword(field.key)}
                        >
                          {showPasswords[field.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ) : (
                      <input
                        type="text"
                        className="input-field"
                        placeholder={field.placeholder || ""}
                        value={credentials[field.key] || ""}
                        onChange={(e) => setCredentials((p) => ({ ...p, [field.key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-cyan-500/5 border border-cyan-500/15">
                <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400">
                  This connector requires no API credentials — it works locally or via the agent's built-in capabilities.
                </p>
              </div>
            )}

            {/* Instructions */}
            {connector.has_instructions && (
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">
                  <span>{connector.instructions_label || "Custom Instructions"}</span>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs normal-case tracking-normal">
                    optional
                  </span>
                </div>
                <textarea
                  className="textarea-field font-mono text-xs"
                  style={{ minHeight: "100px" }}
                  placeholder={connector.instructions_placeholder || "Enter custom instructions..."}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
                <p className="text-xs text-slate-600 mt-1.5">
                  Instructions are passed to the AI agent when using this connector for analysis.
                </p>
              </div>
            )}

            {/* Test result */}
            {testResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border",
                  testResult.success
                    ? "bg-emerald-500/8 border-emerald-500/25 text-emerald-400"
                    : "bg-red-500/8 border-red-500/25 text-red-400"
                )}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="text-xs font-mono">{testResult.message}</span>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 p-6 border-t border-white/8">
            {connector.fields.length > 0 && (
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-1.5 btn-ghost text-sm disabled:opacity-40"
              >
                <TestTube2 className={clsx("w-4 h-4", testing && "animate-spin")} />
                {testing ? "Testing..." : "Test"}
              </button>
            )}
            <div className="flex-1" />
            <button onClick={onClose} className="btn-ghost text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-1.5 disabled:opacity-40"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
