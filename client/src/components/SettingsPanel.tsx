import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useStore } from "../store/useStore";

const ACCENTS = ["#7c5cff", "#22c55e", "#f97316", "#ef4444", "#06b6d4", "#ec4899"];
const TABS = ["General", "Appearance", "Downloads", "Media", "Categories", "Security"] as const;

type TabName = (typeof TABS)[number];

export function SettingsPanel({
  open,
  onClose,
  initialTab,
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: TabName;
}) {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const categories = useStore((s) => s.categories);
  const upsertCategory = useStore((s) => s.upsertCategory);
  const removeCategory = useStore((s) => s.removeCategory);

  const [tab, setTab] = useState<TabName>("General");
  const [greeting, setGreeting] = useState("");
  const [searchEngine, setSearchEngine] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [accent, setAccent] = useState("#7c5cff");
  const [sabUrl, setSabUrl] = useState("");
  const [sabKey, setSabKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [arr, setArr] = useState({
    sonarr_url: "",
    sonarr_api_key: "",
    radarr_url: "",
    radarr_api_key: "",
  });
  const [testingArr, setTestingArr] = useState<"sonarr" | "radarr" | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (open && initialTab) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!settings) return;
    setGreeting(settings.greeting_name ?? "");
    setSearchEngine(settings.search_engine ?? "");
    setTheme((settings.theme as "dark" | "light") ?? "dark");
    setAccent(settings.accent_color ?? "#7c5cff");
    setSabUrl(settings.sabnzbd_url ?? "");
    setArr({
      sonarr_url: settings.sonarr_url ?? "",
      sonarr_api_key: "",
      radarr_url: settings.radarr_url ?? "",
      radarr_api_key: "",
    });
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

  async function testArr(service: "sonarr" | "radarr") {
    const url = arr[`${service}_url`];
    const apiKey = arr[`${service}_api_key`];
    if (!url || !apiKey) return toast.error("Enter URL and API key");
    setTestingArr(service);
    try {
      const result = await api.post<{ ok: boolean; error?: string; version?: string }>(
        "/settings/arr/test",
        { service, url, apiKey }
      );
      if (result.ok) toast.success(`Connected (v${result.version ?? "?"})`);
      else toast.error(result.error ?? "Connection failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setTestingArr(null);
    }
  }

  async function saveArr(service: "sonarr" | "radarr") {
    const url = arr[`${service}_url`];
    const apiKey = arr[`${service}_api_key`];
    const payload: Record<string, string> = { [`${service}_url`]: url };
    // An empty key field means "leave the stored key alone".
    if (apiKey) payload[`${service}_api_key`] = apiKey;
    await api.put("/settings", payload);
    setSettings({
      ...settings!,
      [`${service}_url`]: url,
      [`${service}_configured`]: String(Boolean(url && (apiKey || settings![`${service}_configured`] === "true"))),
    });
    setArr((a) => ({ ...a, [`${service}_api_key`]: "" }));
    toast.success(`${service === "sonarr" ? "Sonarr" : "Radarr"} saved`);
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
            <div className="w-40 shrink-0 hairline border-r p-3">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    tab === t ? "bg-accent/20 text-accent" : "text-ink-muted hover:sunken hover:text-ink"
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
                  <label className="text-sm text-ink-muted">
                    Greeting name
                    <input
                      value={greeting}
                      onChange={(e) => setGreeting(e.target.value)}
                      placeholder="e.g. Nir"
                      className="field mt-1"
                    />
                  </label>
                  <label className="text-sm text-ink-muted">
                    Web search engine (use %s for the query)
                    <input
                      value={searchEngine}
                      onChange={(e) => setSearchEngine(e.target.value)}
                      className="field mt-1"
                    />
                  </label>
                  <button
                    onClick={saveGeneral}
                    className="btn-primary ml-auto"
                  >
                    Save
                  </button>
                </div>
              )}

              {tab === "Appearance" && (
                <div className="flex flex-col gap-4">
                  <h2 className="text-lg font-semibold">Appearance</h2>
                  <div>
                    <p className="mb-2 text-sm text-ink-muted">Theme</p>
                    <div className="flex gap-2">
                      {(["dark", "light"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setTheme(t);
                            saveAppearance(t, accent);
                          }}
                          className={`rounded-xl border px-4 py-2 text-sm capitalize ${
                            theme === t ? "border-accent text-accent" : "hairline text-ink-muted"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm text-ink-muted">Accent color</p>
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
                  <p className="text-sm text-ink-muted">
                    Connect SABnzbd to show live download progress on the dashboard.
                  </p>
                  <label className="text-sm text-ink-muted">
                    Server URL
                    <input
                      value={sabUrl}
                      onChange={(e) => setSabUrl(e.target.value)}
                      placeholder="http://sabnzbd.local:8080"
                      className="field mt-1"
                    />
                  </label>
                  <label className="text-sm text-ink-muted">
                    API key
                    <input
                      type="password"
                      value={sabKey}
                      onChange={(e) => setSabKey(e.target.value)}
                      placeholder={settings.sabnzbd_configured === "true" ? "•••••••• (unchanged)" : "Found in SABnzbd → Config → General"}
                      className="field mt-1"
                    />
                  </label>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={testSabnzbd}
                      disabled={testing}
                      className="btn-outline disabled:opacity-50"
                    >
                      {testing ? "Testing…" : "Test connection"}
                    </button>
                    <button
                      onClick={saveSabnzbd}
                      className="btn-primary"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              {tab === "Media" && (
                <div className="flex flex-col gap-5">
                  <div>
                    <h2 className="text-lg font-semibold">Media libraries</h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      Connect Sonarr and Radarr to show recently downloaded episodes and movies,
                      with posters and descriptions pulled from your own instances.
                    </p>
                  </div>

                  {(["sonarr", "radarr"] as const).map((service) => (
                    <div key={service} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold uppercase tracking-wide text-ink">
                          {service === "sonarr" ? "Sonarr" : "Radarr"}
                        </h3>
                        {settings[`${service}_configured`] === "true" && (
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                            Connected
                          </span>
                        )}
                      </div>
                      <input
                        value={arr[`${service}_url`]}
                        onChange={(e) => setArr((a) => ({ ...a, [`${service}_url`]: e.target.value }))}
                        placeholder={`http://${service}.local:${service === "sonarr" ? "8989" : "7878"}`}
                        className="field"
                      />
                      <input
                        type="password"
                        value={arr[`${service}_api_key`]}
                        onChange={(e) =>
                          setArr((a) => ({ ...a, [`${service}_api_key`]: e.target.value }))
                        }
                        placeholder={
                          settings[`${service}_configured`] === "true"
                            ? "•••••••• (unchanged)"
                            : "API key — Settings → General in " + service
                        }
                        className="field"
                      />
                      <div className="ml-auto flex gap-2">
                        <button
                          onClick={() => testArr(service)}
                          disabled={testingArr === service}
                          className="btn-outline disabled:opacity-50"
                        >
                          {testingArr === service ? "Testing…" : "Test"}
                        </button>
                        <button onClick={() => saveArr(service)} className="btn-primary">
                          Save
                        </button>
                      </div>
                    </div>
                  ))}
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
                      className="field flex-1"
                    />
                    <button
                      onClick={addCategory}
                      className="btn-primary"
                    >
                      Add
                    </button>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {categories.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between rounded-xl sunken px-3 py-2 text-sm"
                      >
                        {c.name}
                        <button onClick={() => deleteCategory(c.id)} className="text-ink-muted hover:text-red-400">
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
                  <p className="text-sm text-ink-muted">
                    Set a password to lock editing behind a login. Leave current password blank on first setup.
                  </p>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="field"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className="field"
                  />
                  <button
                    type="submit"
                    className="btn-primary ml-auto"
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
