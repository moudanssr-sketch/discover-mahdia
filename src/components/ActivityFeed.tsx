import { Bell, CheckCircle2, Radio, XCircle } from "lucide-react";
import type { ActivityEvent } from "../../shared/types";

const iconFor = (type: ActivityEvent["type"]) => {
  if (type === "object_found") return CheckCircle2;
  if (type === "wrong_scan") return XCircle;
  if (type === "game_started" || type === "game_ended") return Radio;
  return Bell;
};

export function ActivityFeed({ events, large = false }: { events: ActivityEvent[]; large?: boolean }) {
  if (!events.length) {
    return <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-ivory/70">Activity will appear live.</p>;
  }

  return (
    <div className="space-y-3">
      {events.slice(0, large ? 12 : 6).map((event) => {
        const Icon = iconFor(event.type);
        return (
          <article key={event.id} className="grid grid-cols-[auto_1fr] gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-white/10 text-gold">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <p className={large ? "text-lg font-semibold text-ivory" : "text-sm font-semibold text-ivory"}>{event.message}</p>
              <p className="mt-1 text-xs text-ivory/50">
                {new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {typeof event.points === "number" ? ` - ${event.points > 0 ? "+" : ""}${event.points} pts` : ""}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
