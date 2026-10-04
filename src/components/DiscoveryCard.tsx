import { ArrowRight, Medal, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import type { PublicObject, ValidationSuccess } from "../../shared/types";
import { PrimaryButton } from "./ui";

export function DiscoveryCard({
  object,
  result,
  onContinue,
  loading
}: {
  object: PublicObject;
  result: ValidationSuccess;
  onContinue: () => void;
  loading?: boolean;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-3xl overflow-hidden rounded-lg border border-gold/30 bg-black/40 shadow-glow backdrop-blur-xl"
    >
      <div className="grid md:grid-cols-[.9fr_1.1fr]">
        <img src={object.imageUrl || "/mahdia-map.svg"} alt="" className="h-full min-h-72 w-full object-cover" />
        <div className="p-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold uppercase tracking-[.18em] text-gold">
            <Sparkles className="h-4 w-4" /> Discovery Validated
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-ivory">{object.name}</h1>
          <p className="mt-3 text-sm leading-6 text-ivory/70">{object.historicalInfo}</p>
          <div className="mt-4 space-y-2">
            {object.facts.map((fact) => (
              <p key={fact} className="rounded-lg border border-white/10 bg-white/[.06] p-3 text-sm text-ivory/70">
                {fact}
              </p>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-lagoon/25 bg-lagoon/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-lagoon">
              <Medal className="h-4 w-4" /> +{result.pointsAwarded} points
            </p>
            <p className="mt-1 text-xs text-ivory/60">
              Base {result.bonuses.base} - Speed {result.bonuses.speed} - Combo {result.bonuses.combo} - Streak {result.bonuses.streak}
            </p>
          </div>
          <PrimaryButton className="mt-5 w-full" onClick={onContinue} disabled={loading}>
            Continue <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </div>
      </div>
    </motion.article>
  );
}
