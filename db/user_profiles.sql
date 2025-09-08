-- Supabase user_profiles table and RLS policies
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

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_user_profiles_updated on public.user_profiles;
create trigger trg_user_profiles_updated
before update on public.user_profiles
for each row execute function public.set_updated_at();

create index if not exists idx_user_profiles_user_id on public.user_profiles (user_id);
create unique index if not exists uq_user_profiles_user_id on public.user_profiles (user_id);

alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from anon, authenticated;

create policy if not exists user_profiles_select_owner
  on public.user_profiles for select using (user_id = auth.uid());

create policy if not exists user_profiles_insert_owner
  on public.user_profiles for insert with check (user_id = auth.uid());

create policy if not exists user_profiles_update_owner
  on public.user_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy if not exists user_profiles_delete_owner
  on public.user_profiles for delete using (user_id = auth.uid());
