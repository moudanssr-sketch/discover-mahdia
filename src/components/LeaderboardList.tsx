import { Award, Flame, Medal, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import type { LeaderboardEntry } from "../../shared/types";

export function LeaderboardList({ entries, compact = false }: { entries: LeaderboardEntry[]; compact?: boolean }) {
  if (!entries.length) {
    return <p className="rounded-lg border border-white/10 bg-black/20 p-5 text-sm text-ivory/70">No players yet.</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <motion.div
          layout
          key={entry.playerId}
          className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-3"
        >
          <div className="grid h-10 w-10 place-items-center rounded-md bg-gold/20 text-gold">
            {entry.rank === 1 ? <Trophy className="h-5 w-5" /> : <span className="font-semibold">{entry.rank}</span>}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ivory">{entry.nickname}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ivory/60">
              <span className="inline-flex items-center gap-1">
                <Medal className="h-3.5 w-3.5 text-lagoon" /> {entry.discoveries} finds
              </span>
              <span className="inline-flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-coral" /> {entry.streak} streak
              </span>
              {!compact && (
                <span className="inline-flex items-center gap-1">
                  <Award className="h-3.5 w-3.5 text-gold" /> {entry.achievements.length} badges
                </span>
              )}
            </div>
          </div>
          <p className="text-right text-2xl font-semibold text-gold">{entry.score}</p>
        </motion.div>
      ))}
    </div>
  );
}
