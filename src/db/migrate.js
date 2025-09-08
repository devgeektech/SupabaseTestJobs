import { Client } from "pg";

const DDL = `
-- Create table (Supabase has pgcrypto; gen_random_uuid() available)
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  first_name text,
  last_name text,
  email text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Updated_at trigger function
create or replace function public.set_updated_at() returns trigger as $func$
begin
  new.updated_at = now();
  return new;
end
$func$ language plpgsql;

drop trigger if exists trg_user_profiles_updated on public.user_profiles;
create trigger trg_user_profiles_updated
before update on public.user_profiles
for each row execute function public.set_updated_at();

-- Indexes and uniqueness per user
create index if not exists idx_user_profiles_user_id on public.user_profiles (user_id);
-- Remove unique constraint to allow multiple rows per user
drop index if exists uq_user_profiles_user_id;

-- RLS and policies
alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles TO authenticated;

-- Drop existing policies if present (for idempotency)
drop policy if exists user_profiles_select_owner on public.user_profiles;
drop policy if exists user_profiles_insert_owner on public.user_profiles;
drop policy if exists user_profiles_update_owner on public.user_profiles;
drop policy if exists user_profiles_delete_owner on public.user_profiles;

-- Recreate policies
create policy user_profiles_select_owner
  on public.user_profiles for select using (user_id = auth.uid());

create policy user_profiles_insert_owner
  on public.user_profiles for insert with check (user_id = auth.uid());

create policy user_profiles_update_owner
  on public.user_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_profiles_delete_owner
  on public.user_profiles for delete using (user_id = auth.uid());
`;

export async function migrateIfEnabled() {
  if (process.env.SUPABASE_MIGRATE_ON_START !== "true") return;
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.warn("SUPABASE_MIGRATE_ON_START=true but SUPABASE_DB_URL is not set; skipping migration");
    return;
  }
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    await client.query(DDL);
    console.log("Migration completed or already applied.");
  } catch (e) {
    console.log("consssssssss",e)
    console.error("Migration failed:", e.message);
  } finally {
    await client.end();
  }

}
