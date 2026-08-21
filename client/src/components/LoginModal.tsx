import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useStore } from "../store/useStore";

export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const refreshAuth = useStore((s) => s.refreshAuth);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/login", { password });
      await refreshAuth();
      toast.success("Welcome back");
      setPassword("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.form
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="glass w-full max-w-sm rounded-2xl p-6"
          >
            <h2 className="mb-4 text-lg font-semibold">Sign in to edit</h2>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm focus:border-accent/60 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
