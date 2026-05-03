-- =============================================================================
-- ACTIVITY COACH — SUPABASE SCHEMA
-- Last updated: May 2026
-- Multi-user version — all personal tables have user_id
-- =============================================================================
-- If rebuilding from scratch, run this entire file in the Supabase SQL editor.
-- =============================================================================


-- =============================================================================
-- TABLE: activities
-- =============================================================================
create table activities (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  type text not null check (type in (
    'running',
    'cycling_indoor',
    'cycling_outdoor',
    'fishing',
    'kung_fu',
    'gym',
    'other'
  )),
  date timestamptz not null default now(),
  duration_minutes integer not null check (duration_minutes > 0),
  notes text,
  distance_km numeric(6, 2),
  avg_heart_rate integer,
  avg_pace text,
  avg_speed_kmh numeric(5, 1),
  elevation_m integer,
  calories integer,
  avg_power_w integer,
  ai_notes text,
  created_at timestamptz default now()
);

alter table activities enable row level security;
create policy "Users can only access own activities" on activities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- =============================================================================
-- TABLE: mood_logs
-- =============================================================================
create table mood_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  log_date date not null default current_date,
  mood_score integer not null check (mood_score between 1 and 5),
  energy_score integer not null check (energy_score between 1 and 5),
  notes text,
  created_at timestamptz default now(),
  unique(user_id, log_date)
);

alter table mood_logs enable row level security;
create policy "Users can only access own mood_logs" on mood_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- =============================================================================
-- TABLE: agent_suggestions
-- =============================================================================
create table agent_suggestions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  suggestion_date date not null default current_date,
  suggested_activity text not null,
  suggestion_text text not null,
  reasoning text,
  kung_fu_element text,
  kung_fu_suggestion text,
  was_followed boolean,
  email_sent boolean default false,
  created_at timestamptz default now(),
  unique(user_id, suggestion_date)
);

alter table agent_suggestions enable row level security;
create policy "Users can only access own agent_suggestions" on agent_suggestions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- =============================================================================
-- TABLE: diet_logs
-- =============================================================================
create table diet_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  log_date date not null,
  created_at timestamptz default now(),
  weight_kg numeric(5, 2),
  kcal integer,
  fat_g numeric(6, 1),
  sat_fat_g numeric(6, 1),
  carbs_g numeric(6, 1),
  sugar_g numeric(6, 1),
  fibre_g numeric(6, 1),
  protein_g numeric(6, 1),
  salt_g numeric(6, 2),
  kcal_pct integer,
  protein_pct integer,
  unique(user_id, log_date)
);

alter table diet_logs enable row level security;
create policy "Users can only access own diet_logs" on diet_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- =============================================================================
-- TABLE: settings
-- =============================================================================
create table settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  key text not null,
  value text not null,
  updated_at timestamptz default now(),
  unique(user_id, key)
);

alter table settings enable row level security;
create policy "Users can only access own settings" on settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- =============================================================================
-- TABLE: kung_fu_elements
-- Shared across all users — no user_id needed
-- =============================================================================
create table kung_fu_elements (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  min_sash text not null default 'red' check (min_sash in ('red', 'yellow', 'next')),
  sort_order integer default 0,
  active boolean default true,
  created_at timestamptz default now()
);

alter table kung_fu_elements enable row level security;
create policy "Allow all on kung_fu_elements" on kung_fu_elements
  for all using (true) with check (true);

-- Seed kung fu elements
insert into kung_fu_elements (name, description, min_sash, sort_order) values
('Qi Gong', 'Stationary breathing practice — minimum 5 minutes daily', 'red', 1),
('Fa Jing', 'Explosive power practice combining single and triple strikes', 'red', 2),
('Footwork combinations', 'Base stance, single step and double step combinations', 'red', 3),
('Sup Luk Dun', '16 movements form — foundation of Lung Ying practice', 'red', 4),
('Sam Tong', 'Second level form', 'yellow', 5),
('Dan Bian', 'Third level form', 'next', 6),
('Si Men Da', 'Third level form', 'next', 7);