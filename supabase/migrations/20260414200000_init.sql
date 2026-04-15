-- Initial TimeROI schema + RLS policies.
-- Applied via Supabase CLI: `supabase db push`

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  streak int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, nullif(split_part(new.email, '@', 1), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.time_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  duration int not null check (duration > 0 and duration <= 1440),
  created_at timestamptz not null default now()
);

create index if not exists time_logs_user_created_idx on public.time_logs (user_id, created_at desc);

alter table public.time_logs enable row level security;

drop policy if exists "time_logs_select_own" on public.time_logs;
create policy "time_logs_select_own"
on public.time_logs
for select
using (auth.uid() = user_id);

drop policy if exists "time_logs_insert_own" on public.time_logs;
create policy "time_logs_insert_own"
on public.time_logs
for insert
with check (auth.uid() = user_id);

drop policy if exists "time_logs_update_own" on public.time_logs;
create policy "time_logs_update_own"
on public.time_logs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "time_logs_delete_own" on public.time_logs;
create policy "time_logs_delete_own"
on public.time_logs
for delete
using (auth.uid() = user_id);

create table if not exists public.daily_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  date date not null
);

create index if not exists daily_quests_user_date_idx on public.daily_quests (user_id, date);
create unique index if not exists daily_quests_user_title_date_uniq on public.daily_quests (user_id, title, date);

alter table public.daily_quests enable row level security;

drop policy if exists "daily_quests_select_own" on public.daily_quests;
create policy "daily_quests_select_own"
on public.daily_quests
for select
using (auth.uid() = user_id);

drop policy if exists "daily_quests_insert_own" on public.daily_quests;
create policy "daily_quests_insert_own"
on public.daily_quests
for insert
with check (auth.uid() = user_id);

drop policy if exists "daily_quests_update_own" on public.daily_quests;
create policy "daily_quests_update_own"
on public.daily_quests
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "daily_quests_delete_own" on public.daily_quests;
create policy "daily_quests_delete_own"
on public.daily_quests
for delete
using (auth.uid() = user_id);

create table if not exists public.user_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  pref_key text not null,
  pref_value text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, pref_key)
);

alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences_select_own" on public.user_preferences;
create policy "user_preferences_select_own"
on public.user_preferences
for select
using (auth.uid() = user_id);

drop policy if exists "user_preferences_upsert_own" on public.user_preferences;
create policy "user_preferences_upsert_own"
on public.user_preferences
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own"
on public.user_preferences
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_preferences_delete_own" on public.user_preferences;
create policy "user_preferences_delete_own"
on public.user_preferences
for delete
using (auth.uid() = user_id);
