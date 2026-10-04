import { useQuery } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { api } from "../api/client";
import { LeaderboardList } from "../components/LeaderboardList";
import { TopNav } from "../components/TopNav";
import { GlassPanel, PageFrame, ProgressBar, StatTile } from "../components/ui";
import { gameStateKey } from "../hooks/useGameSocket";

export function LeaderboardPage() {
  const { data: state } = useQuery({ queryKey: gameStateKey, queryFn: api.state });

  return (
    <PageFrame>
      <TopNav />
      <section className="mx-auto mt-8 grid max-w-7xl gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[.22em] text-gold">
            <Crown className="h-4 w-4" /> Live ranking
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-ivory">Leaderboard</h1>
          <div className="mt-6">
            <LeaderboardList entries={state?.leaderboard ?? []} />
          </div>
        </div>
        <GlassPanel className="p-5">
          <p className="font-semibold text-ivory">Game Status</p>
          <div className="mt-4">
            <ProgressBar value={state?.stats.progressPercent ?? 0} />
          </div>
          <div className="mt-4 grid gap-3">
            <StatTile label="Progress" value={`${state?.stats.progressPercent ?? 0}%`} />
            <StatTile label="Remaining" value={state?.stats.remainingObjects ?? 0} accent="lagoon" />
            <StatTile label="Wrong scans" value={state?.stats.wrongScans ?? 0} accent="coral" />
          </div>
        </GlassPanel>
      </section>
    </PageFrame>
  );
}
