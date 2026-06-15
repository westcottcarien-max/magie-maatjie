-- ============================================================
-- Family Meal Planner — Supabase Schema
-- Run this in the Supabase SQL Editor (once, top to bottom)
-- ============================================================

-- 1. MEALS
create table if not exists meals (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  notes      text,
  created_at timestamptz default now()
);

-- 2. INGREDIENTS (belong to a meal; deleted when meal is deleted)
create table if not exists ingredients (
  id         uuid primary key default gen_random_uuid(),
  meal_id    uuid references meals(id) on delete cascade,
  quantity   text,
  unit       text,
  item_name  text not null,
  sort_order int  default 0
);

-- 3. WEEKLY PLANS
create table if not exists weekly_plans (
  id          uuid primary key default gen_random_uuid(),
  share_token text unique default encode(gen_random_bytes(6), 'hex'),
  week_label  text,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- 4. PLAN MEALS (which meal on which day; 0=Mon … 6=Sun)
create table if not exists plan_meals (
  id        uuid primary key default gen_random_uuid(),
  plan_id   uuid references weekly_plans(id) on delete cascade,
  day_index int  not null,
  meal_id   uuid references meals(id) on delete set null
);

-- 5. FAMILY SELECTIONS (submitted by family members via share link)
create table if not exists family_selections (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid references weekly_plans(id) on delete cascade,
  member_name       text not null,
  selected_meal_ids uuid[] default '{}',
  submitted_at      timestamptz default now()
);

-- ============================================================
-- Row Level Security — allow anonymous access for family app
-- ============================================================

alter table meals             enable row level security;
alter table ingredients       enable row level security;
alter table weekly_plans      enable row level security;
alter table plan_meals        enable row level security;
alter table family_selections enable row level security;

-- Allow the anon role to do everything (no auth required).
-- You can tighten this later once you add authentication.

create policy "anon all" on meals             for all using (true) with check (true);
create policy "anon all" on ingredients       for all using (true) with check (true);
create policy "anon all" on weekly_plans      for all using (true) with check (true);
create policy "anon all" on plan_meals        for all using (true) with check (true);
create policy "anon all" on family_selections for all using (true) with check (true);
