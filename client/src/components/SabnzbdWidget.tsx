import { motion } from "framer-motion";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { socket } from "../lib/socket";
import { useStore } from "../store/useStore";

function statusColor(status: string) {
  switch (status.toLowerCase()) {
    case "downloading":
      return "bg-accent";
    case "paused":
      return "bg-amber-500";
    case "queued":
      return "bg-slate-500";
    default:
      return "bg-emerald-500";
  }
}

export function SabnzbdWidget() {
  const sabnzbd = useStore((s) => s.sabnzbd);
  const setSabnzbd = useStore((s) => s.setSabnzbd);
  const authed = useStore((s) => s.authed);

  useEffect(() => {
    function onUpdate(snapshot: any) {
      setSabnzbd(snapshot);
    }
    socket.on("sabnzbd:update", onUpdate);
    return () => {
      socket.off("sabnzbd:update", onUpdate);
    };
  }, [setSabnzbd]);

  if (!sabnzbd || !sabnzbd.configured) return null;

  async function act(fn: () => Promise<unknown>, label: string) {
    try {
      await fn();
    } catch (err) {
      toast.error(`${label} failed`);
    }
  }

  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent">
            ⬇
          </div>
          <h2 className="text-base font-semibold">Downloads</h2>
        </div>

        {!sabnzbd.reachable ? (
          <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-400">
            Unreachable
          </span>
        ) : (
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span className="font-mono text-accent">{sabnzbd.speed}</span>
            {sabnzbd.timeleft && <span>ETA {sabnzbd.timeleft}</span>}
            {authed && (
              <button
                onClick={() =>
                  act(
                    () => (sabnzbd.paused ? api.post("/sabnzbd/resume") : api.post("/sabnzbd/pause")),
                    sabnzbd.paused ? "Resume" : "Pause"
                  )
                }
                className="rounded-lg border border-white/10 px-2 py-1 text-xs hover:border-accent/60 hover:text-accent"
              >
                {sabnzbd.paused ? "Resume all" : "Pause all"}
              </button>
            )}
          </div>
        )}
      </div>

      {sabnzbd.queue.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">No active downloads</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sabnzbd.queue.map((slot) => (
            <motion.div
              key={slot.nzo_id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-white/5 p-3"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium" title={slot.filename}>
                  {slot.filename}
                </span>
                <span className="shrink-0 font-mono text-xs text-slate-400">
                  {slot.percentage.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className={`h-full rounded-full ${statusColor(slot.status)}`}
                  animate={{ width: `${slot.percentage}%` }}
                  transition={{ ease: "easeOut" }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {slot.cat && <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5">{slot.cat}</span>}
                  {slot.status} · {slot.sizeleft} left of {slot.size}
                  {slot.timeleft ? ` · ETA ${slot.timeleft}` : ""}
                </span>
                {authed && (
                  <div className="flex gap-2 opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100">
                    <button
                      onClick={() =>
                        act(
                          () =>
                            slot.status.toLowerCase() === "paused"
                              ? api.post(`/sabnzbd/jobs/${slot.nzo_id}/resume`)
                              : api.post(`/sabnzbd/jobs/${slot.nzo_id}/pause`),
                          "Update"
                        )
                      }
                      className="hover:text-accent"
                    >
                      {slot.status.toLowerCase() === "paused" ? "Resume" : "Pause"}
                    </button>
                    <button
                      onClick={() => act(() => api.delete(`/sabnzbd/jobs/${slot.nzo_id}`), "Delete")}
                      className="hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {sabnzbd.history.length > 0 && (
        <div className="mt-4 border-t border-white/5 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recently completed
          </h3>
          <ul className="flex flex-col gap-1.5">
            {sabnzbd.history.slice(0, 5).map((h) => (
              <li key={h.nzo_id} className="flex items-center justify-between text-xs">
                <span className="truncate text-slate-400" title={h.name}>
                  {h.name}
                </span>
                <span
                  className={
                    h.status === "Failed" ? "text-red-400" : "text-emerald-400"
                  }
                >
                  {h.status === "Failed" ? "Failed" : h.size}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
