import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crosshair, Download, ImagePlus, Lock, Play, Plus, RotateCcw, Save, Square, Trash2, Upload } from "lucide-react";
import type { AdminObject, ObjectInput } from "../../shared/types";
import { ADMIN_TOKEN_KEY, api } from "../api/client";
import { GalleryMap } from "../components/GalleryMap";
import { TopNav } from "../components/TopNav";
import { GlassPanel, PageFrame, PrimaryButton, ProgressBar, SecondaryButton, StatTile } from "../components/ui";
import { gameStateKey } from "../hooks/useGameSocket";

interface ObjectFormState {
  name: string;
  imageUrl: string;
  description: string;
  historicalInfo: string;
  factsText: string;
  category: string;
  points: number;
  positionX: number;
  positionY: number;
  latitude: number;
  longitude: number;
  claimRadiusMeters: number;
}

const emptyForm: ObjectFormState = {
  name: "",
  imageUrl: "",
  description: "",
  historicalInfo: "",
  factsText: "",
  category: "heritage",
  points: 100,
  positionX: 50,
  positionY: 50,
  latitude: 35.5047,
  longitude: 11.0622,
  claimRadiusMeters: 25
};

const toInput = (form: ObjectFormState): ObjectInput => ({
  name: form.name,
  imageUrl: form.imageUrl,
  description: form.description,
  historicalInfo: form.historicalInfo,
  facts: form.factsText
    .split("\n")
    .map((fact) => fact.trim())
    .filter(Boolean),
  category: form.category,
  points: Number(form.points),
  positionX: Number(form.positionX),
  positionY: Number(form.positionY),
  latitude: Number(form.latitude),
  longitude: Number(form.longitude),
  claimRadiusMeters: Number(form.claimRadiusMeters)
});

const fromObject = (object: AdminObject): ObjectFormState => ({
  name: object.name,
  imageUrl: object.imageUrl,
  description: object.description,
  historicalInfo: object.historicalInfo,
  factsText: object.facts.join("\n"),
  category: object.category,
  points: object.points,
  positionX: object.positionX,
  positionY: object.positionY,
  latitude: object.latitude,
  longitude: object.longitude,
  claimRadiusMeters: object.claimRadiusMeters
});

export function AdminPage() {
  const queryClient = useQueryClient();
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) ?? "");
  const [credentials, setCredentials] = useState({ username: "admin", password: "" });
  const [form, setForm] = useState<ObjectFormState>(emptyForm);
  const [gpsMessage, setGpsMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [positionDrafts, setPositionDrafts] = useState<Record<string, { positionX: number; positionY: number }>>({});

  const { data: state } = useQuery({ queryKey: gameStateKey, queryFn: api.state });
  const objectsQuery = useQuery({
    queryKey: ["admin-objects", adminToken],
    queryFn: () => api.adminObjects(adminToken),
    enabled: Boolean(adminToken)
  });

  const displayedObjects = useMemo(
    () =>
      (objectsQuery.data ?? []).map((object) =>
        positionDrafts[object.id] ? { ...object, ...positionDrafts[object.id] } : object
      ),
    [objectsQuery.data, positionDrafts]
  );

  const loginMutation = useMutation({
    mutationFn: () => api.adminLogin(credentials.username, credentials.password),
    onSuccess: (result) => {
      localStorage.setItem(ADMIN_TOKEN_KEY, result.token);
      setAdminToken(result.token);
    }
  });

  const refreshAdmin = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-objects"] });
    queryClient.invalidateQueries({ queryKey: gameStateKey });
  };

  const controlMutation = useMutation({
    mutationFn: (action: "start" | "end" | "reset") => {
      if (action === "start") return api.startGame(adminToken);
      if (action === "end") return api.endGame(adminToken);
      return api.resetGame(adminToken);
    },
    onSuccess: (nextState) => {
      queryClient.setQueryData(gameStateKey, nextState);
      refreshAdmin();
    }
  });

  const saveObjectMutation = useMutation({
    mutationFn: () => (editingId ? api.updateObject(adminToken, editingId, toInput(form)) : api.createObject(adminToken, toInput(form))),
    onSuccess: () => {
      setForm(emptyForm);
      setEditingId(null);
      refreshAdmin();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteObject(adminToken, id),
    onSuccess: refreshAdmin
  });

  const uploadMapMutation = useMutation({
    mutationFn: (file: File) => api.uploadMap(adminToken, file),
    onSuccess: (nextState) => {
      queryClient.setQueryData(gameStateKey, nextState);
      refreshAdmin();
    }
  });

  const uploadImageMutation = useMutation({
    mutationFn: (file: File) => api.uploadObjectImage(adminToken, file),
    onSuccess: (result) => setForm((current) => ({ ...current, imageUrl: result.imageUrl }))
  });

  const savePositionsMutation = useMutation({
    mutationFn: async () => {
      const objects = objectsQuery.data ?? [];
      for (const object of objects) {
        const draft = positionDrafts[object.id];
        if (draft) {
          await api.updateObject(adminToken, object.id, toInput({ ...fromObject(object), ...draft }));
        }
      }
    },
    onSuccess: () => {
      setPositionDrafts({});
      refreshAdmin();
    }
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    saveObjectMutation.mutate();
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsMessage("GPS is not available on this device.");
      return;
    }
    setGpsMessage("Reading current GPS position...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6))
        }));
        setGpsMessage(`Location set. Accuracy ${Math.round(position.coords.accuracy)}m.`);
      },
      (error) => setGpsMessage(error.message || "Could not read GPS position."),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
    );
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!adminToken) {
    return (
      <PageFrame>
        <TopNav />
        <section className="mx-auto mt-16 max-w-md">
          <GlassPanel className="p-6">
            <p className="flex items-center gap-2 text-lg font-semibold text-ivory">
              <Lock className="h-5 w-5 text-gold" /> Admin Login
            </p>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                loginMutation.mutate();
              }}
            >
              <input
                className="min-h-12 w-full rounded-md border border-white/10 bg-black/30 px-3 text-ivory outline-none focus:border-gold"
                value={credentials.username}
                onChange={(event) => setCredentials((current) => ({ ...current, username: event.target.value }))}
                placeholder="Username"
              />
              <input
                type="password"
                className="min-h-12 w-full rounded-md border border-white/10 bg-black/30 px-3 text-ivory outline-none focus:border-gold"
                value={credentials.password}
                onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
                placeholder="Password"
              />
              <PrimaryButton className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Signing in..." : "Login"}
              </PrimaryButton>
              {loginMutation.error && <p className="text-sm text-coral">{loginMutation.error.message}</p>}
            </form>
          </GlassPanel>
        </section>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <TopNav />
      <section className="mx-auto mt-6 max-w-7xl space-y-6">
        <GlassPanel className="p-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[.22em] text-gold">Admin Dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold text-ivory">Game Control Center</h1>
              <div className="mt-5">
                <ProgressBar value={state?.stats.progressPercent ?? 0} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[34rem]">
              <StatTile label="Status" value={state?.game.status ?? "loading"} />
              <StatTile label="Players" value={state?.stats.totalPlayers ?? 0} accent="lagoon" />
              <StatTile label="Found" value={state?.stats.foundObjects ?? 0} />
              <StatTile label="Wrong" value={state?.stats.wrongScans ?? 0} accent="coral" />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <PrimaryButton onClick={() => controlMutation.mutate("start")} disabled={controlMutation.isPending}>
              <Play className="h-4 w-4" /> Start
            </PrimaryButton>
            <SecondaryButton onClick={() => controlMutation.mutate("end")} disabled={controlMutation.isPending}>
              <Square className="h-4 w-4" /> End
            </SecondaryButton>
            <SecondaryButton onClick={() => controlMutation.mutate("reset")} disabled={controlMutation.isPending}>
              <RotateCcw className="h-4 w-4" /> Reset
            </SecondaryButton>
            <SecondaryButton
              onClick={async () => downloadBlob(await api.exportResults(adminToken), `discover-mahdia-results-${Date.now()}.json`)}
            >
              <Download className="h-4 w-4" /> Export
            </SecondaryButton>
            <SecondaryButton
              onClick={() => {
                localStorage.removeItem(ADMIN_TOKEN_KEY);
                setAdminToken("");
              }}
            >
              Logout
            </SecondaryButton>
          </div>
        </GlassPanel>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <GlassPanel className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-ivory">Map Editor</p>
                <p className="text-sm text-ivory/60">Upload a map and drag object markers.</p>
              </div>
              <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-gold/40 bg-white/[.07] px-4 py-2 text-sm font-semibold text-ivory transition hover:border-gold/70">
                <Upload className="h-4 w-4" /> Upload map
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadMapMutation.mutate(file);
                  }}
                />
              </label>
            </div>
            <GalleryMap
              admin
              mapUrl={state?.game.mapUrl ?? "/mahdia-map.svg"}
              objects={displayedObjects}
              onObjectMove={(object, positionX, positionY) =>
                setPositionDrafts((current) => ({ ...current, [object.id]: { positionX, positionY } }))
              }
            />
            <PrimaryButton
              className="mt-4 w-full"
              disabled={!Object.keys(positionDrafts).length || savePositionsMutation.isPending}
              onClick={() => savePositionsMutation.mutate()}
            >
              <Save className="h-4 w-4" /> Save marker positions
            </PrimaryButton>
          </GlassPanel>

          <GlassPanel className="p-5">
            <p className="text-lg font-semibold text-ivory">{editingId ? "Edit Object" : "Add Object"}</p>
            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
              <input className="admin-input" placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <input
                className="admin-input"
                placeholder="Image URL"
                value={form.imageUrl}
                onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
              />
              <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-white/10 bg-black/25 px-3 text-sm font-semibold text-ivory">
                <ImagePlus className="h-4 w-4 text-gold" /> Upload object image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadImageMutation.mutate(file);
                  }}
                />
              </label>
              <textarea
                className="admin-input min-h-20"
                placeholder="Short description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
              <textarea
                className="admin-input min-h-32"
                placeholder="Historical information"
                value={form.historicalInfo}
                onChange={(event) => setForm({ ...form, historicalInfo: event.target.value })}
              />
              <textarea
                className="admin-input min-h-24"
                placeholder="Interesting facts, one per line"
                value={form.factsText}
                onChange={(event) => setForm({ ...form, factsText: event.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="admin-input"
                  placeholder="Category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                />
                <input
                  className="admin-input"
                  type="number"
                  placeholder="Points"
                  value={form.points}
                  onChange={(event) => setForm({ ...form, points: Number(event.target.value) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="admin-input"
                  type="number"
                  min={0}
                  max={100}
                  value={form.positionX}
                  onChange={(event) => setForm({ ...form, positionX: Number(event.target.value) })}
                />
                <input
                  className="admin-input"
                  type="number"
                  min={0}
                  max={100}
                  value={form.positionY}
                  onChange={(event) => setForm({ ...form, positionY: Number(event.target.value) })}
                />
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ivory">Physical claim location</p>
                  <SecondaryButton type="button" className="min-h-9 px-3" onClick={useCurrentLocation}>
                    <Crosshair className="h-4 w-4" /> Use current GPS
                  </SecondaryButton>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="admin-input"
                    type="number"
                    step="0.000001"
                    min={-90}
                    max={90}
                    placeholder="Latitude"
                    value={form.latitude}
                    onChange={(event) => setForm({ ...form, latitude: Number(event.target.value) })}
                  />
                  <input
                    className="admin-input"
                    type="number"
                    step="0.000001"
                    min={-180}
                    max={180}
                    placeholder="Longitude"
                    value={form.longitude}
                    onChange={(event) => setForm({ ...form, longitude: Number(event.target.value) })}
                  />
                </div>
                <input
                  className="admin-input mt-3"
                  type="number"
                  min={3}
                  max={500}
                  placeholder="Claim radius in meters"
                  value={form.claimRadiusMeters}
                  onChange={(event) => setForm({ ...form, claimRadiusMeters: Number(event.target.value) })}
                />
                {gpsMessage && <p className="mt-2 text-xs text-ivory/60">{gpsMessage}</p>}
              </div>
              <div className="flex gap-2">
                <PrimaryButton className="flex-1" disabled={saveObjectMutation.isPending}>
                  <Plus className="h-4 w-4" /> {editingId ? "Save" : "Add"}
                </PrimaryButton>
                {editingId && (
                  <SecondaryButton
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm);
                    }}
                  >
                    Cancel
                  </SecondaryButton>
                )}
              </div>
              {saveObjectMutation.error && <p className="text-sm text-coral">{saveObjectMutation.error.message}</p>}
            </form>
          </GlassPanel>
        </div>

        <GlassPanel className="p-5">
          <p className="mb-4 text-lg font-semibold text-ivory">Objects and QR Codes</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(objectsQuery.data ?? []).map((object) => (
              <article key={object.id} className="rounded-lg border border-white/10 bg-black/[.22] p-4">
                <div className="flex gap-3">
                  <img src={object.imageUrl || "/mahdia-map.svg"} alt="" className="h-16 w-20 rounded-md object-cover" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ivory">{object.name}</p>
                    <p className="text-sm text-ivory/60">{object.status}</p>
                    <p className="text-xs text-ivory/50">x {object.positionX.toFixed(1)} / y {object.positionY.toFixed(1)}</p>
                    <p className="text-xs text-ivory/50">
                      GPS {object.latitude.toFixed(5)}, {object.longitude.toFixed(5)} / {object.claimRadiusMeters}m
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <SecondaryButton
                    className="min-h-10 px-2"
                    onClick={() => {
                      setEditingId(object.id);
                      setForm(fromObject(object));
                    }}
                  >
                    Edit
                  </SecondaryButton>
                  <SecondaryButton
                    className="min-h-10 px-2"
                    onClick={async () => downloadBlob(await api.downloadQr(adminToken, object.id), `${object.slug}-qr.png`)}
                  >
                    QR
                  </SecondaryButton>
                  <SecondaryButton className="min-h-10 px-2 text-coral" onClick={() => deleteMutation.mutate(object.id)}>
                    <Trash2 className="h-4 w-4" />
                  </SecondaryButton>
                </div>
              </article>
            ))}
          </div>
        </GlassPanel>
      </section>
    </PageFrame>
  );
}
