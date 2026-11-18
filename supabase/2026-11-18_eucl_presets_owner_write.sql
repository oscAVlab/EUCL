-- EUCL presets: public read, write only for the app owner(s).
-- Applied on Supabase project "Tools". After the owner signs up in EUCL (NUBE → CREAR CUENTA):
--   insert into public.app_owners(app,user_id) select 'eucl', id from auth.users where email = '<owner email>';

-- backup before changing access
create table if not exists public.eucl_presets_backup_20261118 as select * from public.eucl_presets;
alter table public.eucl_presets_backup_20261118 enable row level security;

-- who may write each app's cloud presets
create table if not exists public.app_owners(
  app text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(app,user_id)
);
alter table public.app_owners enable row level security;
drop policy if exists "own row readable" on public.app_owners;
create policy "own row readable" on public.app_owners for select to authenticated using (user_id = auth.uid());

create or replace function public.is_app_owner(p_app text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.app_owners where app = p_app and user_id = auth.uid());
$$;
revoke all on function public.is_app_owner(text) from public;
grant execute on function public.is_app_owner(text) to anon, authenticated;

alter table public.eucl_presets add column if not exists owner_id uuid default auth.uid();

drop policy if exists "public read write" on public.eucl_presets;
create policy "eucl read" on public.eucl_presets for select using (true);
create policy "eucl owner insert" on public.eucl_presets for insert to authenticated with check (public.is_app_owner('eucl'));
create policy "eucl owner update" on public.eucl_presets for update to authenticated using (public.is_app_owner('eucl')) with check (public.is_app_owner('eucl'));
create policy "eucl owner delete" on public.eucl_presets for delete to authenticated using (public.is_app_owner('eucl'));
