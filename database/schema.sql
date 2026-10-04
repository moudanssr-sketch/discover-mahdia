CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE game_status AS ENUM ('waiting', 'running', 'ended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE object_status AS ENUM ('available', 'reserved', 'found');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Discover Mahdia',
  status game_status NOT NULL DEFAULT 'waiting',
  map_url TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 3600,
  scoring_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  combo INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  wrong_scans INTEGER NOT NULL DEFAULT 0,
  discoveries INTEGER NOT NULL DEFAULT 0,
  current_object_id UUID,
  current_assigned_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  image_url TEXT,
  description TEXT NOT NULL,
  historical_info TEXT NOT NULL,
  facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  category TEXT NOT NULL DEFAULT 'heritage',
  points INTEGER NOT NULL DEFAULT 100,
  qr_token TEXT NOT NULL UNIQUE,
  status object_status NOT NULL DEFAULT 'available',
  reserved_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  found_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  found_at TIMESTAMPTZ,
  position_x NUMERIC(5,2) NOT NULL DEFAULT 50,
  position_y NUMERIC(5,2) NOT NULL DEFAULT 50,
  latitude NUMERIC(9,6) NOT NULL DEFAULT 35.504700,
  longitude NUMERIC(9,6) NOT NULL DEFAULT 11.062200,
  claim_radius_meters INTEGER NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, slug)
);

DO $$ BEGIN
  ALTER TABLE players
    ADD CONSTRAINT players_current_object_fk
    FOREIGN KEY (current_object_id) REFERENCES objects(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE objects ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6) NOT NULL DEFAULT 35.504700;
ALTER TABLE objects ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6) NOT NULL DEFAULT 11.062200;
ALTER TABLE objects ADD COLUMN IF NOT EXISTS claim_radius_meters INTEGER NOT NULL DEFAULT 25;

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_achievements (
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS history_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  object_id UUID REFERENCES objects(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  points INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_statistics (
  game_id UUID PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
  total_players INTEGER NOT NULL DEFAULT 0,
  total_objects INTEGER NOT NULL DEFAULT 0,
  found_objects INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  wrong_scans INTEGER NOT NULL DEFAULT 0,
  fastest_discovery_seconds INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id,
  p.game_id,
  p.nickname,
  p.score,
  p.discoveries,
  p.combo,
  p.streak,
  p.wrong_scans,
  rank() OVER (PARTITION BY p.game_id ORDER BY p.score DESC, p.discoveries DESC, p.joined_at ASC) AS rank
FROM players p;

CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_objects_game_status ON objects(game_id, status);
CREATE INDEX IF NOT EXISTS idx_objects_qr_token ON objects(qr_token);
CREATE INDEX IF NOT EXISTS idx_history_events_game_created ON history_events(game_id, created_at DESC);

INSERT INTO achievements (id, name, description, icon, category, points)
VALUES
  ('first-find', 'First Discovery', 'Validated the first heritage object.', 'Sparkles', 'exploration', 25),
  ('speed-runner', 'Swift Explorer', 'Found an object within the speed bonus window.', 'Zap', 'speed', 30),
  ('triple-streak', 'Perfect Streak', 'Completed three successful missions without a wrong scan.', 'Flame', 'collection', 40),
  ('historian', 'Heritage Keeper', 'Discovered three Mahdia history objects.', 'Landmark', 'history', 40),
  ('champion', 'Mahdia Champion', 'Finished the hunt at the top of the leaderboard.', 'Trophy', 'completion', 100)
ON CONFLICT (id) DO NOTHING;
