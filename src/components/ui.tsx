import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { Link, type LinkProps } from "react-router-dom";
import clsx from "clsx";
import { motion } from "framer-motion";

export function PageFrame({ children, tv = false }: PropsWithChildren<{ tv?: boolean }>) {
  return (
    <main
      className={clsx(
        "relative isolate min-h-screen overflow-hidden bg-obsidian text-ivory",
        "bg-museum-grid [background-size:42px_42px]",
        tv ? "p-6" : "px-4 py-5 sm:px-6 lg:px-8"
      )}
    >
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(30,167,168,.22),transparent_32%),linear-gradient(145deg,rgba(7,17,31,.94),rgba(11,27,48,.91)_55%,rgba(55,35,10,.78))]" />
      {children}
    </main>
  );
}

export function GlassPanel({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={clsx(
        "rounded-lg border border-white/10 bg-white/[.075] shadow-glass backdrop-blur-xl",
        "ring-1 ring-gold/10",
        className
      )}
    >
      {children}
    </motion.section>
  );
}

export function PrimaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-obsidian",
        "transition hover:bg-[#efc765] focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-obsidian disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    />
  );
}

export function SecondaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-gold/40 bg-white/[.07] px-4 py-2 text-sm font-semibold text-ivory",
        "transition hover:border-gold/70 hover:bg-white/[.12] focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-obsidian disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    />
  );
}

export function LinkButton({ className, ...props }: LinkProps) {
  return (
    <Link
      {...props}
      className={clsx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-gold/40 bg-white/[.07] px-4 py-2 text-sm font-semibold text-ivory",
        "transition hover:border-gold/70 hover:bg-white/[.12] focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-obsidian",
        className
      )}
    />
  );
}

export function StatTile({ label, value, accent = "gold" }: { label: string; value: string | number; accent?: "gold" | "lagoon" | "coral" }) {
  const accentClass = {
    gold: "text-gold",
    lagoon: "text-lagoon",
    coral: "text-coral"
  }[accent];

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-[.18em] text-ivory/60">{label}</p>
      <p className={clsx("mt-1 text-2xl font-semibold", accentClass)}>{value}</p>
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-black/40" aria-label={`Progress ${value}%`}>
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-lagoon via-gold to-coral"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.5 }}
      />
    </div>
  );
}

export function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}
