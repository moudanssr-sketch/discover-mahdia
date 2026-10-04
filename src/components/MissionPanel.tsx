import { Compass, Radar, Sparkles, View } from "lucide-react";
import { useEffect, useState } from "react";
import type { ClaimLocation, PublicObject } from "../../shared/types";
import { LinkButton, PrimaryButton, ProgressBar } from "./ui";

const distanceMeters = (from: ClaimLocation, to: { latitude: number; longitude: number }) => {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

export function MissionPanel({
  mission,
  onClaim,
  claiming = false
}: {
  mission?: PublicObject;
  onClaim?: (location: ClaimLocation) => void;
  claiming?: boolean;
}) {
  const [location, setLocation] = useState<ClaimLocation | null>(null);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    setLocation(null);
    setLocationError("");
    if (!mission || !navigator.geolocation) {
      if (mission && !navigator.geolocation) {
        setLocationError("GPS is not available on this device.");
      }
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setLocationError("");
      },
      (error) => {
        setLocationError(error.message || "Allow location access to reveal the virtual artifact.");
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [mission?.id]);

  if (!mission) {
    return (
      <div className="rounded-lg border border-dashed border-gold/30 bg-black/20 p-5">
        <p className="flex items-center gap-2 text-lg font-semibold text-ivory">
          <Compass className="h-5 w-5 text-gold" /> Waiting for mission
        </p>
        <p className="mt-2 text-sm leading-6 text-ivory/70">A new available object will be assigned when the game is running.</p>
      </div>
    );
  }

  const distance = location ? distanceMeters(location, mission) : undefined;
  const detectionRange = Math.max(mission.claimRadiusMeters * 4, mission.claimRadiusMeters + 25);
  const proximity =
    distance === undefined ? 0 : Math.max(0, Math.min(100, 100 - (distance / detectionRange) * 100));
  const inRange = distance !== undefined && distance <= mission.claimRadiusMeters;
  const distanceLabel = distance === undefined ? "Waiting for GPS" : `${Math.round(distance)}m away`;

  return (
    <article className="overflow-hidden rounded-lg border border-gold/25 bg-black/[.22]">
      {inRange ? (
        <div className="relative">
          <img src={mission.imageUrl || "/mahdia-map.svg"} alt="" className="h-52 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-obsidian/90 to-transparent p-4">
            <p className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-1 text-xs font-semibold uppercase text-obsidian">
              <Sparkles className="h-4 w-4" /> Virtual item appeared
            </p>
          </div>
        </div>
      ) : (
        <div className="grid h-52 place-items-center bg-black/25 px-5 text-center">
          <div>
            <Radar className="mx-auto h-12 w-12 animate-pulse text-lagoon" />
            <p className="mt-4 text-sm font-semibold uppercase tracking-[.18em] text-lagoon">Searching nearby</p>
            <p className="mt-2 text-sm leading-6 text-ivory/65">
              {locationError || "Move closer to make the virtual artifact appear."}
            </p>
          </div>
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 text-gold">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-[.2em]">Current Mission</span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold text-ivory">{mission.name}</h2>
        <p className="mt-2 text-sm leading-6 text-ivory/70">{mission.description}</p>
        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
          <p className="mb-3 flex items-center justify-between gap-3 text-sm font-semibold text-ivory">
            <span className="inline-flex items-center gap-2">
              <View className="h-4 w-4 text-lagoon" /> Proximity
            </span>
            <span className={inRange ? "text-gold" : "text-ivory/60"}>{inRange ? "In range" : distanceLabel}</span>
          </p>
          <ProgressBar value={proximity} />
          <p className="mt-3 text-xs leading-5 text-ivory/60">
            Claim radius: {mission.claimRadiusMeters}m. GPS accuracy: {location?.accuracy ? `${Math.round(location.accuracy)}m` : "pending"}.
          </p>
        </div>
        <PrimaryButton className="mt-5 w-full" onClick={() => location && onClaim?.(location)} disabled={!inRange || claiming || !onClaim}>
          {claiming ? "Claiming..." : "Claim virtual item"}
        </PrimaryButton>
        <LinkButton to="/leaderboard" className="mt-5 w-full">
          Leaderboard
        </LinkButton>
      </div>
    </article>
  );
}
