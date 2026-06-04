-- Run in Supabase SQL Editor after creating your project.
-- Enables per-user data isolation, usage metering, and billing profiles.

-- ---------------------------------------------------------------------------
-- Ledger key-value store (applications, outreach, meetings, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_kv (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.ledger_kv enable row level security;

create policy "ledger_kv_select_own"
  on public.ledger_kv for select
  using (auth.uid() = user_id);

create policy "ledger_kv_insert_own"
  on public.ledger_kv for insert
  with check (auth.uid() = user_id);

create policy "ledger_kv_update_own"
  on public.ledger_kv for update
  using (auth.uid() = user_id);

create policy "ledger_kv_delete_own"
  on public.ledger_kv for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- API usage events — one row per Anthropic call
-- ---------------------------------------------------------------------------
create table if not exists public.api_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null default 'general',
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists api_usage_events_user_created_idx
  on public.api_usage_events (user_id, created_at desc);

alter table public.api_usage_events enable row level security;

create policy "api_usage_select_own"
  on public.api_usage_events for select
  using (auth.uid() = user_id);

-- Inserts happen server-side via service role only (no client insert policy).

-- ---------------------------------------------------------------------------
-- Billing profile — Stripe customer + subscription state
-- ---------------------------------------------------------------------------
create table if not exists public.billing_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  billing_status text not null default 'trial',
  trial_remaining_cents integer not null default 500,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_profiles enable row level security;

create policy "billing_profiles_select_own"
  on public.billing_profiles for select
  using (auth.uid() = user_id);

-- Auto-create billing profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.billing_profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- OAuth tokens (Gmail, etc.) — server-only via service role, no client RLS
-- ---------------------------------------------------------------------------
create table if not exists public.user_integrations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gmail_tokens jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_integrations enable row level security;
-- Intentionally no policies: only the service role (API routes) may read/write tokens.
