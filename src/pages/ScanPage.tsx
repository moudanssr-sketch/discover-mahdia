import { useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { api, getPlayerSession } from "../api/client";
import { DiscoveryCard } from "../components/DiscoveryCard";
import { PageFrame, PrimaryButton } from "../components/ui";
import { gameStateKey } from "../hooks/useGameSocket";

export function ScanPage() {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = getPlayerSession();
  const validatedRef = useRef(false);

  const validateMutation = useMutation({
    mutationFn: () => api.validateQr(session.token ?? "", qrToken ?? ""),
    onSuccess: (result) => queryClient.setQueryData(gameStateKey, result.state)
  });

  const nextMissionMutation = useMutation({
    mutationFn: () => api.nextMission(session.token ?? ""),
    onSuccess: (result) => {
      queryClient.setQueryData(gameStateKey, result.state);
      navigate("/game");
    }
  });

  useEffect(() => {
    if (session.token && qrToken && !validatedRef.current) {
      validatedRef.current = true;
      validateMutation.mutate();
    }
  }, [qrToken, session.token, validateMutation]);

  if (!session.token) {
    return (
      <PageFrame>
        <section className="mx-auto grid min-h-screen max-w-md place-items-center px-4">
          <div className="rounded-lg border border-white/10 bg-black/40 p-6 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-gold" />
            <h1 className="mt-4 text-2xl font-semibold text-ivory">Join first</h1>
            <p className="mt-2 text-sm leading-6 text-ivory/70">Create a player session before scanning object QR codes.</p>
            <Link to="/game" className="mt-5 inline-flex text-sm font-semibold text-gold">
              Go to game
            </Link>
          </div>
        </section>
      </PageFrame>
    );
  }

  const result = validateMutation.data;

  return (
    <PageFrame>
      <section className="grid min-h-screen place-items-center px-4 py-8">
        {validateMutation.isPending && (
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-gold" />
            <p className="mt-4 text-lg font-semibold text-ivory">Validating QR code...</p>
          </div>
        )}

        {validateMutation.error && (
          <div className="max-w-md rounded-lg border border-coral/40 bg-coral/10 p-6 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-coral" />
            <h1 className="mt-4 text-2xl font-semibold text-ivory">Validation failed</h1>
            <p className="mt-2 text-sm leading-6 text-ivory/70">{validateMutation.error.message}</p>
            <PrimaryButton className="mt-5 w-full" onClick={() => navigate("/game")}>
              <ArrowLeft className="h-4 w-4" /> Back to game
            </PrimaryButton>
          </div>
        )}

        {result?.ok && (
          <DiscoveryCard
            object={result.object}
            result={result}
            loading={nextMissionMutation.isPending}
            onContinue={() => nextMissionMutation.mutate()}
          />
        )}

        {result && !result.ok && (
          <div className="max-w-md rounded-lg border border-coral/40 bg-coral/10 p-6 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-coral" />
            <h1 className="mt-4 text-2xl font-semibold text-ivory">Wrong object</h1>
            <p className="mt-2 text-sm leading-6 text-ivory/70">{result.reason}</p>
            <p className="mt-2 text-sm text-coral">Penalty: -{result.penalty} points</p>
            <PrimaryButton className="mt-5 w-full" onClick={() => navigate("/game")}>
              <ArrowLeft className="h-4 w-4" /> Back to mission
            </PrimaryButton>
          </div>
        )}
      </section>
    </PageFrame>
  );
}
