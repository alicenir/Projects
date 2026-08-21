import { useEffect, useState } from "react";

export function Greeting({ name }: { name: string }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 20);
    return () => clearInterval(id);
  }, []);

  const hour = now.getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
        {now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        <span className="mx-2 text-accent">•</span>
        <span className="tabular-nums">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </p>
      <h1 className="mt-1.5 text-[clamp(2rem,4.2vw,3.25rem)] font-extrabold leading-[1.05] tracking-tight text-ink">
        {timeGreeting}
        {name ? (
          <>
            , <span className="text-accent">{name}</span>
          </>
        ) : null}
        !
      </h1>
    </div>
  );
}
