import { useEffect, useState } from "react";
import { Moon, Sun, SunMoon } from "lucide-react";
import { Button } from "@/components/ui/Button";

type ThemePref = "system" | "light" | "dark";
const STORAGE_KEY = "teslamate-unified:theme";
const ORDER: ThemePref[] = ["system", "light", "dark"];
const ICONS = { system: SunMoon, light: Sun, dark: Moon };

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    } catch {
      return "system";
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (pref === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", pref);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // best-effort only
    }
  }, [pref]);

  const Icon = ICONS[pref];

  return (
    <Button
      variant="ghost"
      size="icon"
      title={`Theme: ${pref}`}
      onClick={() => setPref(ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length])}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
