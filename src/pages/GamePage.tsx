import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Radio, RefreshCw, Timer, Trophy, UserRound } from "lucide-react";
import { api, clearPlayerSession, getPlayerSession, savePlayerSession } from "../api/client";
import { AchievementList } from "../components/AchievementList";
import { ActivityFeed } from "../components/ActivityFeed";
import { DiscoveryCard } from "../components/DiscoveryCard";
import { GalleryMap } from "../components/GalleryMap";
import { MissionPanel } from "../components/MissionPanel";
import { TopNav } from "../components/TopNav";
import { GlassPanel, PageFrame, PrimaryButton, ProgressBar, SecondaryButton, StatTile, formatTimer } from "../components/ui";
import { gameStateKey } from "../hooks/useGameSocket";
import type { ClaimLocation } from "../../shared/types";

export function GamePage() {
  const queryClient = useQueryClient();
  const { data: state } = useQuery({ queryKey: gameStateKey, queryFn: api.state });
  const [session, setSession] = useState(getPlayerSession);
  const [nickname, setNickname] = useState("");
  const player = useMemo(
    () => state?.players.find((candidate) => candidate.id === session.playerId),
    [session.playerId, state?.players]
  );
  const mission = state?.objects.find((object) => object.id === player?.currentObjectId);

  const joinMutation = useMutation({
    mutationFn: api.join,
    onSuccess: (result) => {
      savePlayerSession(result.token, result.player.id);
      setSession({ token: result.token, playerId: result.player.id });
      queryClient.setQueryData(gameStateKey, result.state);
    }
  });

  const claimMutation = useMutation({
    mutationFn: (location: ClaimLocation) => api.claimMission(session.token ?? "", location),
    onSuccess: (result) => queryClient.setQueryData(gameStateKey, result.state)
  });

  const nextMissionMutation = useMutation({
    mutationFn: () => api.nextMission(session.token ?? ""),
    onSuccess: (result) => {
      claimMutation.reset();
      queryClient.setQueryData(gameStateKey, result.state);
    }
  });

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    joinMutation.mutate(nickname);
  };

  const handleLeave = () => {
    clearPlayerSession();
    setSession({ token: null, playerId: null });
  };

  return (
    <PageFrame>
      <TopNav />
      <section className="mx-auto mt-6 grid max-w-7xl gap-6 lg:grid-cols-[1.45fr_.85fr]">
        <div className="space-y-6">
          <GlassPanel className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[.2em] text-gold">
                  <Radio className="h-4 w-4" /> {state?.game.status ?? "loading"}
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-ivory">Gallery Hunt</h1>
              </div>
              <div className="flex items-center gap-3 text-right">
                <Timer className="h-6 w-6 text-lagoon" />
                <div>
                  <p className="text-xs uppercase tracking-[.18em] text-ivory/50">Timer</p>
                  <p className="text-2xl font-semibold text-gold">{formatTimer(state?.stats.remainingSeconds ?? 0)}</p>
                </div>
              </div>
            </div>
            <div className="mt-5">
              <ProgressBar value={state?.stats.progressPercent ?? 0} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Score" value={player?.score ?? 0} />
              <StatTile label="Remaining" value={state?.stats.remainingObjects ?? 0} accent="lagoon" />
              <StatTile label="Players" value={state?.stats.totalPlayers ?? 0} />
              <StatTile label="Online" value={state?.stats.connectedPlayers ?? 0} accent="coral" />
            </div>
          </GlassPanel>

          <GalleryMap mapUrl={state?.game.mapUrl ?? "/mahdia-map.svg"} objects={state?.objects ?? []} />

          <GlassPanel className="p-5">
            <p className="mb-4 text-lg font-semibold text-ivory">Live Activity</p>
            <ActivityFeed events={state?.activities ?? []} />
          </GlassPanel>
        </div>

        <aside className="space-y-6">
          {!session.token || !player ? (
            <GlassPanel className="p-5">
              <p className="flex items-center gap-2 text-lg font-semibold text-ivory">
                <UserRound className="h-5 w-5 text-gold" /> Join the Hunt
              </p>
              <form className="mt-5 space-y-3" onSubmit={handleJoin}>
                <label className="block text-sm font-semibold text-ivory/70" htmlFor="nickname">
                  Nickname
                </label>
                <input
                  id="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  className="min-h-12 w-full rounded-md border border-white/10 bg-black/30 px-3 text-ivory outline-none focus:border-gold"
                  placeholder="Explorer name"
                  maxLength={24}
                />
                <PrimaryButton className="w-full" disabled={joinMutation.isPending || nickname.trim().length < 2}>
                  {joinMutation.isPending ? "Joining..." : "Receive Mission"}
                </PrimaryButton>
                {joinMutation.error && <p className="text-sm text-coral">{joinMutation.error.message}</p>}
              </form>
            </GlassPanel>
          ) : (
            <>
              {claimMutation.data?.ok ? (
                <DiscoveryCard
                  object={claimMutation.data.object}
                  result={claimMutation.data}
                  loading={nextMissionMutation.isPending}
                  onContinue={() => nextMissionMutation.mutate()}
                />
              ) : (
                <MissionPanel
                  mission={mission}
                  claiming={claimMutation.isPending}
                  onClaim={(location) => {
                    claimMutation.mutate(location);
                  }}
                />
              )}
              {claimMutation.data && !claimMutation.data.ok && (
                <p className="rounded-lg border border-coral/30 bg-coral/10 p-3 text-sm text-coral">{claimMutation.data.reason}</p>
              )}
              {claimMutation.error && (
                <p className="rounded-lg border border-coral/30 bg-coral/10 p-3 text-sm text-coral">{claimMutation.error.message}</p>
              )}
              {!mission && state?.game.status === "running" && (
                <PrimaryButton className="w-full" onClick={() => nextMissionMutation.mutate()} disabled={nextMissionMutation.isPending}>
                  <RefreshCw className="h-4 w-4" /> Assign next mission
                </PrimaryButton>
              )}
              <GlassPanel className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-ivory">{player.nickname}</p>
                    <p className="text-sm text-ivory/60">{player.discoveries} discoveries</p>
                  </div>
                  <Trophy className="h-8 w-8 text-gold" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <StatTile label="Combo" value={player.combo} accent="lagoon" />
                  <StatTile label="Streak" value={player.streak} accent="coral" />
                </div>
                <div className="mt-5">
                  <AchievementList achievements={player.achievements} />
                </div>
                <SecondaryButton className="mt-5 w-full" onClick={handleLeave}>
                  <LogOut className="h-4 w-4" /> Leave session
                </SecondaryButton>
              </GlassPanel>
            </>
          )}
        </aside>
      </section>
    </PageFrame>
  );
}
