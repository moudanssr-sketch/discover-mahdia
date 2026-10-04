import { Compass, Crown, Monitor, Shield, ScrollText } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

const navItems = [
  { to: "/game", label: "Play", icon: Compass },
  { to: "/instructions", label: "Flow", icon: ScrollText },
  { to: "/leaderboard", label: "Ranks", icon: Crown },
  { to: "/tv", label: "TV", icon: Monitor },
  { to: "/admin", label: "Admin", icon: Shield }
];

export function TopNav() {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 py-2">
      <Link to="/" className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md border border-gold/40 bg-gold/20 text-sm font-black text-gold">
          DM
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold uppercase tracking-[.24em] text-gold">Discover</span>
          <span className="block truncate text-lg font-semibold text-ivory">Mahdia</span>
        </span>
      </Link>
      <nav className="flex items-center gap-1 overflow-x-auto rounded-lg border border-white/10 bg-black/20 p-1 backdrop-blur-xl">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                "inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition",
                isActive ? "bg-gold text-obsidian" : "text-ivory/75 hover:bg-white/10 hover:text-ivory"
              ].join(" ")
            }
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
