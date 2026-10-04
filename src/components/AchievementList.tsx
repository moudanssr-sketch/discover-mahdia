import { Award, Flame, Landmark, Sparkles, Trophy, Zap } from "lucide-react";
import type { PlayerAchievement } from "../../shared/types";

const icons = {
  Award,
  Flame,
  Landmark,
  Sparkles,
  Trophy,
  Zap
};

export function AchievementList({ achievements }: { achievements: PlayerAchievement[] }) {
  if (!achievements.length) {
    return <p className="text-sm text-ivory/60">Achievements unlock as discoveries are validated.</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {achievements.map((achievement) => {
        const Icon = icons[achievement.icon as keyof typeof icons] ?? Award;
        return (
          <div key={achievement.id} className="rounded-lg border border-gold/20 bg-gold/10 p-3">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-gold" />
              <p className="font-semibold text-ivory">{achievement.name}</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-ivory/60">{achievement.description}</p>
          </div>
        );
      })}
    </div>
  );
}
