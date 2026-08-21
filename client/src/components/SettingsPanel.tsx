import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useStore } from "../store/useStore";

const ACCENTS = ["#7c5cff", "#22c55e", "#f97316", "#ef4444", "#06b6d4", "#ec4899"];
const TABS = ["General", "Appearance", "Downloads", "Categories", "Security"] as const;

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const categories = useStore((s) => s.categories);
  const upsertCategory = useStore((s) => s.upsertCategory);
  const removeCategory = useStore((s) => s.removeCategory);

  const [tab, setTab] = useState<(typeof TABS)[number]>("General");
  const [greeting, setGreeting] = useState("");
  const [searchEngine, setSearchEngine] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [accent, setAccent] = useState("#7c5cff");
  const [sabUrl, setSabUrl] = useState("");
  const [sabKey, setSabKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!settings) return;
    setGreeting(settings.greeting_name ?? "");
    setSearchEngine(settings.search_engine ?? "");
    setTheme((settings.theme as "dark" | "light") ?? "dark");
    setAccent(settings.accent_color ?? "#7c5cff");
    setSabUrl(settings.sabnzbd_url ?? "");
  }, [settings, open]);

  async function saveGeneral() {
    await api.put("/settings", { greeting_name: greeting, search_engine: searchEngine });
    setSettings({ ...settings!, greeting_name: greeting, search_engine: searchEngine });
    toast.success("Saved");
  }

  async function saveAppearance(nextTheme = theme, nextAccent = accent) {
    await api.put("/settings", { theme: nextTheme, accent_color: nextAccent });
    setSettings({ ...settings!, theme: nextTheme, accent_color: nextAccent });
    document.documentElement.classList.toggle("light", nextTheme === "light");
    document.documentElement.style.setProperty("--accent", nextAccent);
  }

  async function testSabnzbd() {
    if (!sabUrl || !sabKey) return toast.error("Enter URL and API key");
    setTesting(true);
    try {
      const result = await api.post<{ ok: boolean; error?: string; version?: string }>(
        "/settings/sabnzbd/test",
        { url: sabUrl, apiKey: sabKey }
      );
      if (result.ok) toast.success(`Connected (SABnzbd ${result.version ?? ""})`);
      else toast.error(result.error ?? "Connection failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setTesting(false);
    }
  }

  async function saveSabnzbd() {
    await api.put("/settings", { sabnzbd_url: sabUrl, sabnzbd_api_key: sabKey });
    setSettings({ ...settings!, sabnzbd_url: sabUrl, sabnzbd_configured: String(Boolean(sabUrl && sabKey)) });
    setSabKey("");
    toast.success("SABnzbd connection saved");
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    const { id } = await api.post<{ id: number }>("/categories", {
      name: newCategory.trim(),
      sort_order: categories.length,
    });
    upsertCategory({ id, name: newCategory.trim(), sort_order: categories.length });
    setNewCategory("");
  }

  async function deleteCategory(id: number) {
    if (!confirm("Delete this category? Bookmarks inside it will become uncategorized.")) return;
    await api.delete(`/categories/${id}`);
    removeCategory(id);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 4) return toast.error("Password must be at least 4 characters");
    try {
      await api.post("/auth/set-password", { currentPassword, newPassword });
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    }
  }

  if (!settings) return null;

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
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            onClick={(e) => e.stopPropagation()}
            className="glass flex w-full max-w-2xl overflow-hidden rounded-2xl"
            style={{ maxHeight: "80vh" }}
          >
            <div className="w-40 shrink-0 border-r border-white/10 p-3">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    tab === t ? "bg-accent/20 text-accent" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
              {tab === "General" && (
                <div className="flex flex-col gap-4">
                  <h2 className="text-lg font-semibold">General</h2>
                  <label className="text-sm text-slate-400">
                    Greeting name
                    <input
                      value={greeting}
                      onChange={(e) => setGreeting(e.target.value)}
                      placeholder="e.g. Nir"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent/60 focus:outline-none"
                    />
                  </label>
                  <label className="text-sm text-slate-400">
                    Web search engine (use %s for the query)
                    <input
                      value={searchEngine}
                      onChange={(e) => setSearchEngine(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent/60 focus:outline-none"
                    />
                  </label>
                  <button
                    onClick={saveGeneral}
                    className="ml-auto rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
                  >
                    Save
                  </button>
                </div>
              )}

              {tab === "Appearance" && (
                <div className="flex flex-col gap-4">
                  <h2 className="text-lg font-semibold">Appearance</h2>
                  <div>
                    <p className="mb-2 text-sm text-slate-400">Theme</p>
                    <div className="flex gap-2">
                      {(["dark", "light"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setTheme(t);
                            saveAppearance(t, accent);
                          }}
                          className={`rounded-xl border px-4 py-2 text-sm capitalize ${
                            theme === t ? "border-accent text-accent" : "border-white/10 text-slate-400"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm text-slate-400">Accent color</p>
                    <div className="flex gap-2">
                      {ACCENTS.map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            setAccent(c);
                            saveAppearance(theme, c);
                          }}
                          style={{ background: c }}
                          className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-surface ${
                            accent === c ? "ring-2 ring-white" : ""
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === "Downloads" && (
                <div className="flex flex-col gap-4">
                  <h2 className="text-lg font-semibold">SABnzbd</h2>
                  <p className="text-sm text-slate-400">
                    Connect SABnzbd to show live download progress on the dashboard.
                  </p>
                  <label className="text-sm text-slate-400">
                    Server URL
                    <input
                      value={sabUrl}
                      onChange={(e) => setSabUrl(e.target.value)}
                      placeholder="http://sabnzbd.local:8080"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent/60 focus:outline-none"
                    />
                  </label>
                  <label className="text-sm text-slate-400">
                    API key
                    <input
                      type="password"
                      value={sabKey}
                      onChange={(e) => setSabKey(e.target.value)}
                      placeholder={settings.sabnzbd_configured === "true" ? "•••••••• (unchanged)" : "Found in SABnzbd → Config → General"}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent/60 focus:outline-none"
                    />
                  </label>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={testSabnzbd}
                      disabled={testing}
                      className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:border-accent/60 disabled:opacity-50"
                    >
                      {testing ? "Testing…" : "Test connection"}
                    </button>
                    <button
                      onClick={saveSabnzbd}
                      className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              {tab === "Categories" && (
                <div className="flex flex-col gap-4">
                  <h2 className="text-lg font-semibold">Categories</h2>
                  <div className="flex gap-2">
                    <input
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCategory()}
                      placeholder="New category name"
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent/60 focus:outline-none"
                    />
                    <button
                      onClick={addCategory}
                      className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
                    >
                      Add
                    </button>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {categories.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm"
                      >
                        {c.name}
                        <button onClick={() => deleteCategory(c.id)} className="text-slate-500 hover:text-red-400">
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tab === "Security" && (
                <form onSubmit={savePassword} className="flex flex-col gap-4">
                  <h2 className="text-lg font-semibold">Security</h2>
                  <p className="text-sm text-slate-400">
                    Set a password to lock editing behind a login. Leave current password blank on first setup.
                  </p>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent/60 focus:outline-none"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent/60 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="ml-auto rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
                  >
                    Update password
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
