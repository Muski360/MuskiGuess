-- ============================================================
--  MUSKIGUESS — SCHEMA PROFISSIONAL COM SUPABASE AUTH
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
--  ENUM: game_mode
-- ============================================================
DROP TYPE IF EXISTS game_mode CASCADE;
CREATE TYPE game_mode AS ENUM ('classic', 'dupleto', 'quapleto', 'multiplayer', 'total');


-- ============================================================
--  TABLE: profiles (substitui sua antiga users)
--  Esta tabela referencia auth.users.id
-- ============================================================

DROP TABLE IF EXISTS profiles CASCADE;

CREATE TABLE profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    username VARCHAR(12) NOT NULL UNIQUE,
    level INTEGER NOT NULL DEFAULT 1,
    experience INTEGER NOT NULL DEFAULT 0,
    tag VARCHAR(32),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_username_valid CHECK (username ~ '^[A-Za-z0-9]+$'),
    CONSTRAINT chk_level_min CHECK (level >= 1),
    CONSTRAINT chk_xp_nonneg CHECK (experience >= 0)
);

COMMENT ON TABLE profiles IS 'Extra data for MuskiGuess players linked to Supabase Auth users.';


-- ============================================================
--  TABLE: stats (UUID + FK para profiles)
-- ============================================================

DROP TABLE IF EXISTS stats CASCADE;

CREATE TABLE stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    mode game_mode NOT NULL,

    num_games INTEGER NOT NULL DEFAULT 0,
    num_wins INTEGER NOT NULL DEFAULT 0,
    num_losses INTEGER GENERATED ALWAYS AS (num_games - num_wins) STORED,

    num_multiplayer_games INTEGER,
    num_multiplayer_wins INTEGER,
    num_multiplayer_losses INTEGER GENERATED ALWAYS AS (num_multiplayer_games - num_multiplayer_wins) STORED,

    CONSTRAINT uq_stats_user_mode UNIQUE (user_id, mode),
    CONSTRAINT chk_wins_not_exceed_games CHECK (num_wins <= num_games),

    CONSTRAINT chk_multiplayer_fields CHECK (
        (mode = 'multiplayer' AND num_multiplayer_games IS NOT NULL AND num_multiplayer_wins IS NOT NULL)
        OR
        (mode <> 'multiplayer' AND num_multiplayer_games IS NULL AND num_multiplayer_wins IS NULL)
    )
);

COMMENT ON TABLE stats IS 'Per-user stats for each game mode.';
