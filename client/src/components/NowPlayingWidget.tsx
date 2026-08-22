import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { socket } from "../lib/socket";
import type { PlexStream, TautulliSnapshot } from "../types";

function remaining(stream: PlexStream): string | null {
  if (stream.durationMs === null || stream.viewOffsetMs === null) return null;
  const left = Math.max(0, stream.durationMs - stream.viewOffsetMs);
  const mins = Math.round(left / 60000);
  if (mins < 1) return "ending";
  if (mins < 60) return `${mins}m left`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
}

function Art({ stream }: { stream: PlexStream }) {
  const [failed, setFailed] = useState(false);
  if (!stream.thumb || failed) {
    return <div className="h-full w-full sunken-strong" />;
  }
  return (
    <img
      src={`/api/tautulli/art?thumb=${encodeURIComponent(stream.thumb)}`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
    />
  );
}

function StreamRow({ stream }: { stream: PlexStream }) {
  const paused = stream.state === "paused";
  const left = remaining(stream);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 rounded-xl sunken p-2.5"
    >
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg">
        <Art stream={stream} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink" title={stream.title}>
          {stream.title}
        </p>
        <p className="truncate text-[11px] text-ink-muted" title={stream.subtitle}>
          {stream.subtitle}
        </p>

        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full sunken-strong">
          <motion.div
            className={`h-full rounded-full ${paused ? "bg-amber-500" : "bg-accent"}`}
            initial={false}
            animate={{ width: `${Math.max(stream.progress, 1.5)}%` }}
            transition={{ ease: "easeOut", duration: 0.4 }}
          />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-ink-muted">
          <span className="font-medium text-ink-muted">{stream.user}</span>
          {paused && <span className="text-amber-400">Paused</span>}
          {left && <span className="tabular-nums">{left}</span>}
          {stream.transcoding ? (
            <span className="text-amber-400">Transcoding</span>
          ) : (
            <span className="text-emerald-400/80">Direct play</span>
          )}
          {stream.player && <span className="truncate">{stream.player}</span>}
        </div>
      </div>
    </motion.div>
  );
}

export function NowPlayingWidget() {
  const [snapshot, setSnapshot] = useState<TautulliSnapshot | null>(null);

  useEffect(() => {
    let gotPush = false;
    function onUpdate(next: TautulliSnapshot) {
      gotPush = true;
      setSnapshot(next);
    }
    socket.on("tautulli:update", onUpdate);

    // Seed over REST in case the connect-time emit lands before this listener
    // attaches (same race the other live widgets had).
    api
      .get<TautulliSnapshot>("/tautulli/activity")
      .then((initial) => {
        if (!gotPush) setSnapshot(initial);
      })
      .catch(() => {});

    return () => {
      socket.off("tautulli:update", onUpdate);
    };
  }, []);

  if (!snapshot || !snapshot.configured) return null;

  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          ▶
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-tight text-ink">Now playing</h2>
          <p className="truncate text-xs text-ink-muted">
            {!snapshot.reachable
              ? "Cannot reach Tautulli"
              : snapshot.streamCount === 0
                ? "Nothing streaming"
                : `${snapshot.streamCount} stream${snapshot.streamCount === 1 ? "" : "s"}`}
          </p>
        </div>
        {snapshot.reachable && snapshot.totalBandwidth ? (
          <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-muted">
            {(snapshot.totalBandwidth / 1000).toFixed(1)} Mbps
          </span>
        ) : null}
      </div>

      {!snapshot.reachable ? (
        <p className="rounded-xl bg-red-500/10 px-3.5 py-3 text-xs text-red-300">
          {snapshot.error ?? "Tautulli is unreachable"} — check the URL and API key in Settings.
        </p>
      ) : snapshot.streams.length === 0 ? (
        <p className="py-5 text-center text-sm text-ink-muted">Nobody is watching anything</p>
      ) : (
        <div className="flex flex-col gap-2">
          {snapshot.streams.map((s) => (
            <StreamRow key={s.key} stream={s} />
          ))}
        </div>
      )}
    </section>
  );
}
