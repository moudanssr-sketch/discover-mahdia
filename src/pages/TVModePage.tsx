import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Radio, Trophy, Users } from "lucide-react";
import { api } from "../api/client";
import { ActivityFeed } from "../components/ActivityFeed";
import { LeaderboardList } from "../components/LeaderboardList";
import { PageFrame, ProgressBar, StatTile, formatTimer } from "../components/ui";
import { gameStateKey } from "../hooks/useGameSocket";

export function TVModePage() {
  const { data: state } = useQuery({ queryKey: gameStateKey, queryFn: api.state });
  const winner = state?.winner;

  return (
    <PageFrame tv>
      <section className="grid min-h-[calc(100vh-3rem)] gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <div className="flex flex-col gap-5">
          <div className="rounded-lg border border-white/10 bg-black/[.28] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[.22em] text-gold">
                  <Radio className="h-4 w-4" /> Live TV Mode
                </p>
                <h1 className="mt-2 text-6xl font-semibold text-ivory">Discover Mahdia</h1>
              </div>
              <div className="text-right">
                <p className="text-sm uppercase tracking-[.18em] text-ivory/60">Timer</p>
                <p className="text-6xl font-semibold text-gold">{formatTimer(state?.stats.remainingSeconds ?? 0)}</p>
              </div>
            </div>
            <div className="mt-6">
              <ProgressBar value={state?.stats.progressPercent ?? 0} />
            </div>
            <div className="mt-5 grid grid-cols-4 gap-3">
              <StatTile label="Progress" value={`${state?.stats.progressPercent ?? 0}%`} />
              <StatTile label="Remaining" value={state?.stats.remainingObjects ?? 0} accent="lagoon" />
              <StatTile label="Players" value={state?.stats.totalPlayers ?? 0} />
              <StatTile label="Online" value={state?.stats.connectedPlayers ?? 0} accent="coral" />
            </div>
          </div>
          {winner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg border border-gold/40 bg-gold/20 p-6 text-center shadow-glow"
            >
              <Trophy className="mx-auto h-16 w-16 text-gold" />
              <p className="mt-3 text-xl uppercase tracking-[.22em] text-gold">Winner</p>
              <h2 className="mt-2 text-6xl font-semibold text-ivory">{winner.nickname}</h2>
              <p className="mt-2 text-2xl text-ivory/70">{winner.score} points</p>
            </motion.div>
          )}
          <div className="rounded-lg border border-white/10 bg-black/[.28] p-5">
            <p className="mb-4 flex items-center gap-2 text-xl font-semibold text-ivory">
              <Users className="h-5 w-5 text-lagoon" /> Recent Activity
            </p>
            <ActivityFeed events={state?.activities ?? []} large />
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/[.28] p-5">
          <p className="mb-4 flex items-center gap-2 text-xl font-semibold text-ivory">
            <Trophy className="h-5 w-5 text-gold" /> Rankings
          </p>
          <LeaderboardList entries={state?.leaderboard.slice(0, 8) ?? []} />
        </div>
      </section>
    </PageFrame>
  );
}
