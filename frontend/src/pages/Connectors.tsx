import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plug, Search, CheckCircle2, AlertCircle } from "lucide-react";
import clsx from "clsx";
import ConnectorCard from "../components/ConnectorCard";
import ConnectorModal from "../components/ConnectorModal";
import type { Connector } from "../types";

const API = import.meta.env.VITE_API_URL || "";

const CATEGORIES = ["All", "EDR", "AI", "Threat Intel", "Vulnerability", "Sandbox", "NGFW", "VPN", "Knowledge"];

export default function Connectors() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selected, setSelected] = useState<Connector | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [testing, setTesting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(() => {
    fetch(`${API}/api/connectors`)
      .then((r) => r.json())
      .then(setConnectors)
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async (
    connectorId: string,
    credentials: Record<string, string>,
    instructions: string
  ) => {
    const resp = await fetch(`${API}/api/connectors/${connectorId}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credentials, instructions }),
    });
    if (resp.ok) {
      showToast("Configuration saved successfully", true);
      load();
    } else {
      showToast("Failed to save configuration", false);
    }
  };

  const handleTest = async (connectorId: string) => {
    setTesting(connectorId);
    try {
      const resp = await fetch(`${API}/api/connectors/${connectorId}/test`, { method: "POST" });
      const data = await resp.json();
      showToast(
        data.success ? `${connectorId} connection verified` : `Test failed: ${data.error}`,
        data.success
      );
      return data;
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Network error";
      showToast(`Test failed: ${err}`, false);
      return { success: false, error: err };
    } finally {
      setTesting(null);
    }
  };

  const filtered = connectors.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All" || c.category === category;
    return matchSearch && matchCat;
  });

  const configuredCount = connectors.filter((c) => c.status === "connected").length;

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Plug className="w-5 h-5 text-cyan-400" />
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Connectors</h1>
        </div>
        <p className="text-sm text-slate-500">
          Configure integrations for the AI agent · {configuredCount}/{connectors.length} active
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            className="input-field pl-9"
            placeholder="Search connectors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={clsx(
                "text-xs px-3 py-1.5 rounded-lg transition-all duration-150 font-medium",
                category === cat
                  ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-400"
                  : "text-slate-500 border border-white/6 hover:text-slate-300 hover:border-white/12"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-4">
        {filtered.map((connector, i) => (
          <motion.div
            key={connector.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <ConnectorCard
              connector={connector}
              onConfigure={setSelected}
              onTest={handleTest}
              testing={testing === connector.id}
            />
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-600">
          <Plug className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No connectors match your filter</p>
        </div>
      )}

      {/* Modal */}
      {selected && (
        <ConnectorModal
          connector={selected}
          onClose={() => setSelected(null)}
          onSave={handleSave}
          onTest={handleTest}
        />
      )}

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 16, x: "-50%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={clsx(
            "fixed bottom-6 left-1/2 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border shadow-2xl font-medium",
            toast.ok
              ? "bg-emerald-950 border-emerald-500/30 text-emerald-300"
              : "bg-red-950 border-red-500/30 text-red-300"
          )}
        >
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </motion.div>
      )}
    </div>
  );
}
