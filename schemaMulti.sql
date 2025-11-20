-- ============================================================
--  Supabase multiplayer schema for MuskiGuess
--  Run this script inside the SQL editor of your Supabase project
-- ============================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
--  Table: multiplayer_rooms
-- ============================================================
create table public.multiplayer_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references public.profiles(id) on delete cascade,
  host_name text not null,
  status text not null default 'lobby',
  language text not null default 'pt',
  attempt_limit integer not null default 6,
  rounds_target integer not null default 3,
  round_number integer not null default 0,
  round_active boolean not null default false,
  round_started_at timestamptz,
  round_solution_hash text,
  answer_reveal text,
  round_winner_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_rooms_updated_at
before update on public.multiplayer_rooms
for each row
execute function public.set_updated_at();

alter table public.multiplayer_rooms enable row level security;

-- ============================================================
--  Table: multiplayer_players
-- ============================================================
create table public.multiplayer_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.multiplayer_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  score integer not null default 0,
  is_host boolean not null default false,
  is_bot boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create trigger trg_players_updated_at
before update on public.multiplayer_players
for each row
execute function public.set_updated_at();

alter table public.multiplayer_players enable row level security;

-- Helper function to check if the current auth user belongs to a room
create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from multiplayer_players mp
    where mp.room_id = p_room_id
      and mp.user_id = auth.uid()
  );
$$;

create policy "rooms_select_members"
on public.multiplayer_rooms
for select
using (
  auth.uid() = host_id
  or public.is_room_member(id)
);

create policy "rooms_insert_host"
on public.multiplayer_rooms
for insert
with check (auth.uid() = host_id);

create policy "rooms_update_host"
on public.multiplayer_rooms
for update
using (auth.uid() = host_id)
with check (auth.uid() = host_id);

create policy "rooms_delete_host"
on public.multiplayer_rooms
for delete
using (auth.uid() = host_id);

-- Helper function for lookup by code (permite join sem expor todas as salas)
create or replace function public.lookup_room_by_code(p_code text)
returns public.multiplayer_rooms
language sql
security definer
set search_path = public
as $$
  select *
  from public.multiplayer_rooms
  where upper(code) = upper(p_code)
  limit 1;
$$;

grant execute on function public.lookup_room_by_code(text) to authenticated;

create policy "players_select_members"
on public.multiplayer_players
for select
using (public.is_room_member(room_id) or auth.uid() = user_id);

create policy "players_insert_self"
on public.multiplayer_players
for insert
with check (
  auth.uid() = user_id
  and exists (select 1 from public.multiplayer_rooms where id = room_id)
);

create policy "players_update_self_or_host"
on public.multiplayer_players
for update
using (
  auth.uid() = user_id
  or auth.uid() = (select host_id from public.multiplayer_rooms where id = room_id)
)
with check (
  auth.uid() = user_id
  or auth.uid() = (select host_id from public.multiplayer_rooms where id = room_id)
);

create policy "players_delete_self_or_host"
on public.multiplayer_players
for delete
using (
  auth.uid() = user_id
  or auth.uid() = (select host_id from public.multiplayer_rooms where id = room_id)
);

-- ============================================================
--  Table: multiplayer_guesses
-- ============================================================
create table public.multiplayer_guesses (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.multiplayer_rooms(id) on delete cascade,
  player_id uuid not null references public.multiplayer_players(id) on delete cascade,
  round_number integer not null,
  attempt_number integer not null,
  guess text not null check (char_length(guess) = 5),
  feedback jsonb,
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.multiplayer_guesses enable row level security;

create policy "guesses_select_members"
on public.multiplayer_guesses
for select
using (public.is_room_member(room_id));

create policy "guesses_insert_player"
on public.multiplayer_guesses
for insert
with check (
  auth.uid() = (
    select user_id from public.multiplayer_players where id = player_id
  )
  and public.is_room_member(room_id)
);

create policy "guesses_update_host"
on public.multiplayer_guesses
for update
using (
  auth.uid() = (
    select host_id from public.multiplayer_rooms where id = room_id
  )
)
with check (
  auth.uid() = (
    select host_id from public.multiplayer_rooms where id = room_id
  )
);

-- Optional helper index to accelerate lookups
create index idx_guesses_room_round
  on public.multiplayer_guesses (room_id, round_number);

create index idx_players_room
  on public.multiplayer_players (room_id);

-- Helper RPC to bump scores atomically
create or replace function public.increment_player_score(p_player_id uuid, p_delta int default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.multiplayer_players
    set score = greatest(0, coalesce(score, 0) + greatest(1, p_delta))
    where id = p_player_id;
end;
$$;
