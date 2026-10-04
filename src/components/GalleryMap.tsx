import { Maximize2, Minus, Plus } from "lucide-react";
import type { PointerEvent } from "react";
import { useState } from "react";
import type { AdminObject, PublicObject } from "../../shared/types";
import { SecondaryButton } from "./ui";

export function GalleryMap({
  mapUrl,
  objects,
  admin = false,
  onObjectMove
}: {
  mapUrl: string;
  objects: Array<PublicObject | AdminObject>;
  admin?: boolean;
  onObjectMove?: (object: AdminObject, positionX: number, positionY: number) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const adminObjects = objects.filter((object): object is AdminObject => "positionX" in object);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingId || !admin || !onObjectMove) {
      return;
    }
    const object = adminObjects.find((candidate) => candidate.id === draggingId);
    if (!object) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const positionX = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const positionY = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    onObjectMove(object, positionX, positionY);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/25">
      <div className="flex items-center justify-between border-b border-white/10 p-3">
        <div>
          <p className="text-sm font-semibold text-ivory">Gallery Map</p>
          <p className="text-xs text-ivory/60">{admin ? "Drag markers to position objects." : "Found objects disappear in real time."}</p>
        </div>
        <div className="flex items-center gap-2">
          <SecondaryButton className="min-h-9 px-2" onClick={() => setZoom((value) => Math.max(0.8, value - 0.1))} aria-label="Zoom out">
            <Minus className="h-4 w-4" />
          </SecondaryButton>
          <SecondaryButton className="min-h-9 px-2" onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))} aria-label="Zoom in">
            <Plus className="h-4 w-4" />
          </SecondaryButton>
          <SecondaryButton
            className="min-h-9 px-2"
            onClick={() => document.documentElement.requestFullscreen?.()}
            aria-label="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </SecondaryButton>
        </div>
      </div>
      <div
        className="relative aspect-[16/10] touch-none overflow-hidden"
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDraggingId(null)}
        onPointerCancel={() => setDraggingId(null)}
      >
        <img
          src={mapUrl || "/mahdia-map.svg"}
          alt="Gallery floor plan"
          className="h-full w-full object-cover transition-transform duration-300"
          style={{ transform: `scale(${zoom})` }}
        />
        {admin
          ? adminObjects.map((object) => (
              <button
                key={object.id}
                type="button"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDraggingId(object.id);
                }}
                className="absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-obsidian bg-gold text-xs font-bold text-obsidian shadow-glow"
                style={{ left: `${object.positionX}%`, top: `${object.positionY}%` }}
                title={object.name}
              >
                {object.name.slice(0, 1)}
              </button>
            ))
          : objects
              .filter((object) => object.status !== "found")
              .map((object, index) => (
                <span
                  key={object.id}
                  className="absolute h-3 w-3 rounded-full bg-gold/75 shadow-glow"
                  style={{
                    left: `${18 + ((index * 17) % 66)}%`,
                    top: `${22 + ((index * 23) % 48)}%`
                  }}
                  aria-hidden="true"
                />
              ))}
      </div>
    </div>
  );
}
