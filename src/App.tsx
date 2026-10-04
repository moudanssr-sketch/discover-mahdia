import { Route, Routes } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useGameSocket } from "./hooks/useGameSocket";
import { AdminPage } from "./pages/AdminPage";
import { GamePage } from "./pages/GamePage";
import { InstructionsPage } from "./pages/InstructionsPage";
import { LandingPage } from "./pages/LandingPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { ScanPage } from "./pages/ScanPage";
import { TVModePage } from "./pages/TVModePage";

export default function App() {
  useGameSocket();

  return (
    <AnimatePresence mode="wait">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/instructions" element={<InstructionsPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/tv" element={<TVModePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/scan/:qrToken" element={<ScanPage />} />
      </Routes>
    </AnimatePresence>
  );
}
