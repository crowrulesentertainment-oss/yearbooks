-- Video-only CrowRules Yearbooks integration with Universal CrowRules membership.
-- Additive migration: preserves existing CrowRules tables, policies, and records.

create table if not exists public.cr_yearbook_video_catalog (
  project_id uuid primary key references public.cr_yearbook_projects(id) on delete cascade,
  school_id uuid references public.school_profiles(id) on delete set null,
  title text not null,
  description text,
  academic_year text,
  audience text not null default 'school' check (audience in ('elementary','middle_school','high_school','college','alumni','archive','school')),
  cover_image_url text,
  publication_status text not null default 'draft' check (publication_status in ('draft','review','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cr_yearbook_video_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cr_yearbook_projects(id) on delete cascade,
  title text not null,
  storage_path text not null,
  asset_kind text not null default 'full_yearbook' check (asset_kind in ('full_yearbook','trailer','interview','highlight','bonus')),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected','withdrawn')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cr_yearbook_access_grants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cr_yearbook_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  grant_source text not null default 'shared_passcode',
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  unique(project_id,user_id)
);

create index if not exists cr_yearbook_video_assets_project_idx
  on public.cr_yearbook_video_assets(project_id,approval_status,sort_order);
create index if not exists cr_yearbook_access_grants_user_idx
  on public.cr_yearbook_access_grants(user_id,project_id)
  where revoked_at is null;

alter table public.cr_yearbook_video_catalog enable row level security;
alter table public.cr_yearbook_video_assets enable row level security;
alter table public.cr_yearbook_access_grants enable row level security;

revoke all on public.cr_yearbook_video_catalog from anon, authenticated;
grant select on public.cr_yearbook_video_catalog to anon, authenticated;
grant insert,update,delete on public.cr_yearbook_video_catalog to authenticated;

revoke all on public.cr_yearbook_video_assets from anon, authenticated;
grant select,insert,update,delete on public.cr_yearbook_video_assets to authenticated;

revoke all on public.cr_yearbook_access_grants from anon, authenticated;
grant select,update,delete on public.cr_yearbook_access_grants to authenticated;

create policy cr_yearbook_video_catalog_public_read
  on public.cr_yearbook_video_catalog for select to anon,authenticated
  using (publication_status='published');
create policy cr_yearbook_video_catalog_admin_manage
  on public.cr_yearbook_video_catalog for all to authenticated
  using ((select private.cr_universal_admin_check()))
  with check ((select private.cr_universal_admin_check()));

create policy cr_yearbook_video_assets_admin_manage
  on public.cr_yearbook_video_assets for all to authenticated
  using ((select private.cr_universal_admin_check()))
  with check ((select private.cr_universal_admin_check()));

create policy cr_yearbook_access_grants_self_read
  on public.cr_yearbook_access_grants for select to authenticated
  using (user_id=(select auth.uid()));
create policy cr_yearbook_access_grants_admin_manage
  on public.cr_yearbook_access_grants for all to authenticated
  using ((select private.cr_universal_admin_check()))
  with check ((select private.cr_universal_admin_check()));

-- Keep the shared code and brute-force tracking outside exposed API schemas.
create table if not exists private.cr_yearbook_access_codes (
  code_key text primary key,
  code_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists private.cr_yearbook_access_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists cr_yearbook_access_attempts_user_time_idx
  on private.cr_yearbook_access_attempts(user_id,attempted_at desc);
alter table private.cr_yearbook_access_codes enable row level security;
alter table private.cr_yearbook_access_attempts enable row level security;
revoke all on private.cr_yearbook_access_codes from public,anon,authenticated;
revoke all on private.cr_yearbook_access_attempts from public,anon,authenticated;

insert into private.cr_yearbook_access_codes(code_key,code_hash,is_active)
values ('default',extensions.crypt('crent27',extensions.gen_salt('bf',12)),true)
on conflict (code_key) do update
set code_hash=excluded.code_hash,is_active=true,updated_at=now();

create or replace function private.cr_yearbook_redeem_access(p_code text,p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_attempts integer;
begin
  if v_uid is null or p_code is null or length(p_code)>128 then
    return false;
  end if;

  if not exists (
    select 1 from private.get_my_membership() m
    where m.status in ('active','trialing')
  ) then
    return false;
  end if;

  if not exists (
    select 1 from public.cr_yearbook_video_catalog c
    where c.project_id=p_project_id and c.publication_status='published'
  ) then
    return false;
  end if;

  select count(*) into v_attempts
  from private.cr_yearbook_access_attempts a
  where a.user_id=v_uid and a.attempted_at>now()-interval '15 minutes';

  if v_attempts>=5 then
    return false;
  end if;

  insert into private.cr_yearbook_access_attempts(user_id) values(v_uid);

  select c.code_hash into v_hash
  from private.cr_yearbook_access_codes c
  where c.code_key='default' and c.is_active
  for update;

  if v_hash is null or extensions.crypt(p_code,v_hash) is distinct from v_hash then
    return false;
  end if;

  insert into public.cr_yearbook_access_grants(project_id,user_id,grant_source,granted_at,expires_at,revoked_at)
  values(p_project_id,v_uid,'shared_passcode',now(),null,null)
  on conflict(project_id,user_id) do update
  set grant_source='shared_passcode',granted_at=now(),expires_at=null,revoked_at=null;

  return true;
end;
$function$;

revoke all on function private.cr_yearbook_redeem_access(text,uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.cr_yearbook_redeem_access(text,uuid) to authenticated;

create or replace function public.cr_yearbook_redeem_access(p_code text,p_project_id uuid)
returns boolean
language sql
security invoker
set search_path=''
as $function$
  select private.cr_yearbook_redeem_access(p_code,p_project_id);
$function$;
revoke all on function public.cr_yearbook_redeem_access(text,uuid) from public,anon;
grant execute on function public.cr_yearbook_redeem_access(text,uuid) to authenticated;

-- Private media bucket: viewers receive short-lived signed URLs only after authorization.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('cr-yearbook-videos','cr-yearbook-videos',false,5368709120,
  array['video/mp4','video/webm','video/quicktime','video/x-m4v'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy cr_yearbook_video_storage_admin_read
  on storage.objects for select to authenticated
  using (bucket_id='cr-yearbook-videos' and (select private.cr_universal_admin_check()));
create policy cr_yearbook_video_storage_admin_insert
  on storage.objects for insert to authenticated
  with check (bucket_id='cr-yearbook-videos' and (select private.cr_universal_admin_check()));
create policy cr_yearbook_video_storage_admin_update
  on storage.objects for update to authenticated
  using (bucket_id='cr-yearbook-videos' and (select private.cr_universal_admin_check()))
  with check (bucket_id='cr-yearbook-videos' and (select private.cr_universal_admin_check()));
create policy cr_yearbook_video_storage_admin_delete
  on storage.objects for delete to authenticated
  using (bucket_id='cr-yearbook-videos' and (select private.cr_universal_admin_check()));

-- Activate Yearbooks as a site within the existing universal CrowRules membership system.
update public.membership_sites
set is_active=true,
    site_url='https://crowrulesentertainment-oss.github.io/yearbooks/'
where site_key='yearbooks';
