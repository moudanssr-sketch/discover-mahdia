import { CheckCircle2, Compass, Crown, Info, Radar, Search } from "lucide-react";
import { motion } from "framer-motion";
import { GlassPanel, LinkButton, PageFrame } from "../components/ui";
import { TopNav } from "../components/TopNav";

const steps = [
  {
    icon: Compass,
    title: "Join",
    text: "Enter a nickname and receive one available mission."
  },
  {
    icon: Search,
    title: "Explore",
    text: "Move through the gallery toward the mission area."
  },
  {
    icon: Radar,
    title: "Reveal",
    text: "Allow GPS and get inside the claim radius to reveal the virtual object."
  },
  {
    icon: Info,
    title: "Learn",
    text: "Read the historical card before continuing."
  },
  {
    icon: Crown,
    title: "Compete",
    text: "Earn points, streaks, bonuses, and achievements."
  }
];

export function InstructionsPage() {
  return (
    <PageFrame>
      <TopNav />
      <section className="mx-auto mt-8 max-w-6xl">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[.24em] text-gold">How the hunt works</p>
          <h1 className="mt-3 text-4xl font-semibold text-ivory sm:text-5xl">Explore the gallery without revealing the answer.</h1>
          <p className="mt-4 text-base leading-7 text-ivory/70">
            Missions are assigned privately. Objects disappear for everyone as soon as they are discovered.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-5">
          {steps.map((step, index) => (
            <motion.article
              key={step.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="rounded-lg border border-white/10 bg-black/[.22] p-5"
            >
              <span className="grid h-12 w-12 place-items-center rounded-md bg-gold/20 text-gold">
                <step.icon className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-xl font-semibold text-ivory">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-ivory/70">{step.text}</p>
            </motion.article>
          ))}
        </div>
        <GlassPanel className="mt-8 p-6">
          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold text-ivory">
                <CheckCircle2 className="h-5 w-5 text-lagoon" /> Fair-play rules
              </p>
              <p className="mt-2 text-sm leading-6 text-ivory/70">
                The server accepts claims only for your current reserved mission and verifies your GPS distance before awarding points.
                Discovered objects disappear for everyone, and duplicate claims are blocked.
              </p>
            </div>
            <LinkButton to="/game">Start playing</LinkButton>
          </div>
        </GlassPanel>
      </section>
    </PageFrame>
  );
}
