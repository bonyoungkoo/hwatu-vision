import { cn } from "@/lib/utils";

export function StatusPill({ live }: { live: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        live
          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40"
          : "bg-white/10 text-white/70 ring-1 ring-white/15",
      )}
    >
      <span
        className={cn(
          "inline-block size-1.5 rounded-full",
          live ? "bg-emerald-400" : "bg-white/40",
        )}
      />
      {live ? "LIVE" : "OFF"}
    </span>
  );
}
