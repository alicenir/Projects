import { useEffect, useState } from "react";

export function Clock({ greeting }: { greeting: string }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  const hour = now.getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <p className="text-2xl font-bold tracking-tight sm:text-3xl">
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
      <p className="text-sm text-slate-400">
        {timeGreeting}
        {greeting ? `, ${greeting}` : ""} ·{" "}
        {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
      </p>
    </div>
  );
}
