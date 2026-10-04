import { ArrowRight, Crown, Map, Play, ScrollText, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { gameStateKey } from "../hooks/useGameSocket";
import { LinkButton, PageFrame, ProgressBar, StatTile } from "../components/ui";
import { TopNav } from "../components/TopNav";

export function LandingPage() {
  const { data: state } = useQuery({ queryKey: gameStateKey, queryFn: api.state });

  return (
    <PageFrame>
      <TopNav />
      <section className="relative mx-auto mt-6 grid min-h-[calc(100vh-7rem)] max-w-7xl items-center overflow-hidden rounded-lg border border-white/10 bg-black/25">
        <img src="/mahdia-map.svg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-[.48] map-mask" />
        <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/80 to-transparent" />
        <div className="relative z-10 max-w-3xl px-5 py-12 sm:px-8 lg:px-12">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[.22em] text-gold"
          >
            <Map className="h-4 w-4" /> IEEE ISIMA Student Branch
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mt-5 text-5xl font-semibold leading-tight text-ivory sm:text-6xl lg:text-7xl"
          >
            Discover Mahdia
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="mt-5 max-w-2xl text-base leading-8 text-ivory/75 sm:text-lg"
          >
            A real-time multiplayer treasure hunt where visitors explore the gallery, reveal virtual heritage objects nearby,
            learn Mahdia's history, and climb a live leaderboard.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <LinkButton to="/game" className="border-gold bg-gold text-obsidian hover:bg-[#efc765]">
              <Play className="h-4 w-4" /> Start Hunt <ArrowRight className="h-4 w-4" />
            </LinkButton>
            <LinkButton to="/instructions">
              <ScrollText className="h-4 w-4" /> Instructions
            </LinkButton>
            <LinkButton to="/leaderboard">
              <Crown className="h-4 w-4" /> Leaderboard
            </LinkButton>
          </motion.div>
        </div>
        <div className="relative z-10 self-end p-5 sm:p-8 lg:ml-auto lg:w-[28rem]">
          <div className="rounded-lg border border-white/10 bg-white/[.08] p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-ivory">Live Progress</p>
              <p className="text-sm text-gold">{state?.game.status ?? "loading"}</p>
            </div>
            <div className="mt-4">
              <ProgressBar value={state?.stats.progressPercent ?? 0} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatTile label="Players" value={state?.stats.totalPlayers ?? 0} accent="lagoon" />
              <StatTile label="Found" value={state?.stats.foundObjects ?? 0} />
              <StatTile label="Online" value={state?.stats.connectedPlayers ?? 0} accent="coral" />
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-ivory/60">
              <Users className="h-4 w-4 text-lagoon" /> Scan the booth QR code to join on your phone.
            </p>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}
