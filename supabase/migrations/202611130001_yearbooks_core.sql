-- CrowRules Yearbooks isolated core schema. Review in staging before applying.
-- This migration creates yb_-prefixed objects only; it does not drop existing CrowRules data.
create extension if not exists pgcrypto;
create table if not exists public.yb_schools(id uuid primary key default gen_random_uuid(),name text not null,slug text not null unique,school_type text not null check(school_type in('elementary','middle_school','high_school','college','university','district','other')),district_name text,city text,state text,country text default 'USA',website text,logo_path text,brand_colors jsonb not null default '{}'::jsonb,description text,status text not null default 'draft' check(status in('draft','pending','published','suspended','archived')),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.yb_school_memberships(id uuid primary key default gen_random_uuid(),school_id uuid not null references public.yb_schools(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,role text not null check(role in('school_admin','editor','teacher','viewer','family')),status text not null default 'active' check(status in('invited','active','suspended','revoked')),created_at timestamptz not null default now(),unique(school_id,user_id));
create table if not exists public.yb_yearbooks(id uuid primary key default gen_random_uuid(),school_id uuid not null references public.yb_schools(id) on delete cascade,title text not null,slug text not null,academic_year text,graduation_year integer,yearbook_type text not null check(yearbook_type in('elementary','middle_school','high_school','college','archive','video')),description text,cover_image_path text,visibility text not null default 'private' check(visibility in('public','school','class','invitation')),publication_status text not null default 'draft' check(publication_status in('draft','review','approved','published','archived')),allow_download boolean not null default false,published_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(school_id,slug));
create table if not exists public.yb_yearbook_sections(id uuid primary key default gen_random_uuid(),yearbook_id uuid not null references public.yb_yearbooks(id) on delete cascade,title text not null,sort_order integer not null default 0,content jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create table if not exists public.yb_yearbook_media(id uuid primary key default gen_random_uuid(),yearbook_id uuid not null references public.yb_yearbooks(id) on delete cascade,section_id uuid references public.yb_yearbook_sections(id) on delete set null,storage_path text not null,media_type text not null check(media_type in('image','pdf','video','audio','document')),alt_text text,caption text,approval_status text not null default 'pending' check(approval_status in('pending','approved','rejected','withdrawn')),visibility text not null default 'private' check(visibility in('public','school','class','invitation')),created_at timestamptz not null default now());
create table if not exists public.yb_access_groups(id uuid primary key default gen_random_uuid(),school_id uuid not null references public.yb_schools(id) on delete cascade,name text not null,access_type text not null default 'class' check(access_type in('school','class','family','invitation')),expires_at timestamptz,status text not null default 'active' check(status in('active','expired','revoked')),created_at timestamptz not null default now());
create table if not exists public.yb_access_memberships(id uuid primary key default gen_random_uuid(),access_group_id uuid not null references public.yb_access_groups(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,granted_by uuid references auth.users(id),expires_at timestamptz,revoked_at timestamptz,created_at timestamptz not null default now(),unique(access_group_id,user_id));
create table if not exists public.yb_access_codes(id uuid primary key default gen_random_uuid(),access_group_id uuid not null references public.yb_access_groups(id) on delete cascade,code_hash text not null,expires_at timestamptz,max_uses integer,use_count integer not null default 0,revoked_at timestamptz,created_at timestamptz not null default now());
create table if not exists public.yb_inquiries(id uuid primary key default gen_random_uuid(),reference_number text not null unique,contact_name text not null,organization_name text not null,position text,email text not null,phone text,school_type text,city text,state text,estimated_students integer,target_year text,requested_services jsonb not null default '[]'::jsonb,preferred_meeting_method text,preferred_meeting_date date,message text,consent_to_contact boolean not null default false,status text not null default 'new' check(status in('new','reviewing','contacted','meeting_scheduled','proposal_requested','proposal_sent','accepted','declined','closed')),assigned_to uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.yb_consent_records(id uuid primary key default gen_random_uuid(),school_id uuid not null references public.yb_schools(id) on delete cascade,yearbook_id uuid references public.yb_yearbooks(id) on delete cascade,subject_reference text not null,consent_type text not null,consent_status text not null check(consent_status in('pending','granted','denied','revoked')),effective_date date,expiration_date date,revoked_at timestamptz,created_at timestamptz not null default now());
create table if not exists public.yb_audit_logs(id uuid primary key default gen_random_uuid(),actor_user_id uuid references auth.users(id),school_id uuid references public.yb_schools(id) on delete set null,action text not null,target_table text,target_id uuid,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create index if not exists yb_yearbooks_school_idx on public.yb_yearbooks(school_id,publication_status);
create index if not exists yb_memberships_user_idx on public.yb_school_memberships(user_id,status);
create index if not exists yb_access_memberships_user_idx on public.yb_access_memberships(user_id,revoked_at);
create index if not exists yb_inquiries_status_idx on public.yb_inquiries(status,created_at desc);
create or replace function public.yb_is_school_member(p_school_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.yb_school_memberships m where m.school_id=p_school_id and m.user_id=auth.uid() and m.status='active'); $$;
create or replace function public.yb_has_school_role(p_school_id uuid,p_roles text[]) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.yb_school_memberships m where m.school_id=p_school_id and m.user_id=auth.uid() and m.status='active' and m.role=any(p_roles)); $$;
alter table public.yb_schools enable row level security;
alter table public.yb_school_memberships enable row level security;
alter table public.yb_yearbooks enable row level security;
alter table public.yb_yearbook_sections enable row level security;
alter table public.yb_yearbook_media enable row level security;
alter table public.yb_access_groups enable row level security;
alter table public.yb_access_memberships enable row level security;
alter table public.yb_access_codes enable row level security;
alter table public.yb_inquiries enable row level security;
alter table public.yb_consent_records enable row level security;
alter table public.yb_audit_logs enable row level security;
create policy yb_schools_public_read on public.yb_schools for select to anon,authenticated using(status='published');
create policy yb_schools_member_read on public.yb_schools for select to authenticated using(public.yb_is_school_member(id));
create policy yb_schools_admin_write on public.yb_schools for all to authenticated using(public.yb_has_school_role(id,array['school_admin'])) with check(public.yb_has_school_role(id,array['school_admin']));
create policy yb_memberships_self_read on public.yb_school_memberships for select to authenticated using(user_id=auth.uid() or public.yb_has_school_role(school_id,array['school_admin']));
create policy yb_memberships_admin_manage on public.yb_school_memberships for all to authenticated using(public.yb_has_school_role(school_id,array['school_admin'])) with check(public.yb_has_school_role(school_id,array['school_admin']));
create policy yb_yearbooks_public_read on public.yb_yearbooks for select to anon,authenticated using(visibility='public' and publication_status='published');
create policy yb_yearbooks_school_read on public.yb_yearbooks for select to authenticated using(public.yb_is_school_member(school_id));
create policy yb_yearbooks_editor_manage on public.yb_yearbooks for all to authenticated using(public.yb_has_school_role(school_id,array['school_admin','editor'])) with check(public.yb_has_school_role(school_id,array['school_admin','editor']));
create policy yb_sections_public_read on public.yb_yearbook_sections for select to anon,authenticated using(exists(select 1 from public.yb_yearbooks y where y.id=yearbook_id and y.visibility='public' and y.publication_status='published'));
create policy yb_sections_member_read on public.yb_yearbook_sections for select to authenticated using(exists(select 1 from public.yb_yearbooks y where y.id=yearbook_id and public.yb_is_school_member(y.school_id)));
create policy yb_media_public_read on public.yb_yearbook_media for select to anon,authenticated using(visibility='public' and approval_status='approved' and exists(select 1 from public.yb_yearbooks y where y.id=yearbook_id and y.publication_status='published' and y.visibility='public'));
create policy yb_media_member_read on public.yb_yearbook_media for select to authenticated using(exists(select 1 from public.yb_yearbooks y where y.id=yearbook_id and public.yb_is_school_member(y.school_id)));
create policy yb_media_editor_manage on public.yb_yearbook_media for all to authenticated using(exists(select 1 from public.yb_yearbooks y where y.id=yearbook_id and public.yb_has_school_role(y.school_id,array['school_admin','editor']))) with check(exists(select 1 from public.yb_yearbooks y where y.id=yearbook_id and public.yb_has_school_role(y.school_id,array['school_admin','editor'])));
create policy yb_access_groups_member_read on public.yb_access_groups for select to authenticated using(public.yb_is_school_member(school_id));
create policy yb_access_groups_admin_manage on public.yb_access_groups for all to authenticated using(public.yb_has_school_role(school_id,array['school_admin'])) with check(public.yb_has_school_role(school_id,array['school_admin']));
create policy yb_access_membership_self_read on public.yb_access_memberships for select to authenticated using(user_id=auth.uid());
create policy yb_access_codes_admin_only on public.yb_access_codes for all to authenticated using(exists(select 1 from public.yb_access_groups g where g.id=access_group_id and public.yb_has_school_role(g.school_id,array['school_admin']))) with check(exists(select 1 from public.yb_access_groups g where g.id=access_group_id and public.yb_has_school_role(g.school_id,array['school_admin'])));
create policy yb_inquiries_admin_only on public.yb_inquiries for select to authenticated using(assigned_to=auth.uid() or exists(select 1 from public.yb_school_memberships m where m.user_id=auth.uid() and m.role='school_admin' and m.status='active'));
create policy yb_consent_school_admin on public.yb_consent_records for all to authenticated using(public.yb_has_school_role(school_id,array['school_admin'])) with check(public.yb_has_school_role(school_id,array['school_admin']));
create policy yb_audit_admin_read on public.yb_audit_logs for select to authenticated using(school_id is not null and public.yb_has_school_role(school_id,array['school_admin']));
-- No anonymous inquiry INSERT, private storage access, or raw passcode lookup is granted.
-- Add rate-limited Edge Functions for inquiry intake, code redemption, signed URLs,
-- notification delivery and privileged audit writes before production use.

-- Class/family access is explicitly mapped to a yearbook. A school-wide membership
-- is not automatically sufficient for family/viewer roles.
create table if not exists public.yb_yearbook_access_groups(
 id uuid primary key default gen_random_uuid(),
 yearbook_id uuid not null references public.yb_yearbooks(id) on delete cascade,
 access_group_id uuid not null references public.yb_access_groups(id) on delete cascade,
 created_at timestamptz not null default now(),
 unique(yearbook_id,access_group_id)
);
alter table public.yb_yearbook_access_groups enable row level security;
create or replace function public.yb_can_view_yearbook(p_yearbook_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$
 select exists(
  select 1 from public.yb_yearbooks y
  where y.id=p_yearbook_id and (
   exists(select 1 from public.yb_school_memberships sm
    where sm.school_id=y.school_id and sm.user_id=auth.uid()
    and sm.status='active' and sm.role in('school_admin','editor','teacher'))
   or exists(select 1 from public.yb_yearbook_access_groups yg
    join public.yb_access_groups ag on ag.id=yg.access_group_id
    join public.yb_access_memberships am on am.access_group_id=ag.id
    where yg.yearbook_id=y.id and am.user_id=auth.uid()
    and am.revoked_at is null and (am.expires_at is null or am.expires_at>now())
    and ag.status='active' and (ag.expires_at is null or ag.expires_at>now()))
  )
 );
$$;
drop policy if exists yb_yearbooks_school_read on public.yb_yearbooks;
create policy yb_yearbooks_authorized_read on public.yb_yearbooks
 for select to authenticated using(public.yb_can_view_yearbook(id));
drop policy if exists yb_sections_member_read on public.yb_yearbook_sections;
create policy yb_sections_authorized_read on public.yb_yearbook_sections
 for select to authenticated using(public.yb_can_view_yearbook(yearbook_id));
drop policy if exists yb_media_member_read on public.yb_yearbook_media;
create policy yb_media_authorized_read on public.yb_yearbook_media
 for select to authenticated using(public.yb_can_view_yearbook(yearbook_id));
create policy yb_yearbook_access_groups_admin_manage on public.yb_yearbook_access_groups
 for all to authenticated using(exists(
  select 1 from public.yb_yearbooks y where y.id=yearbook_id
  and public.yb_has_school_role(y.school_id,array['school_admin'])
 )) with check(exists(
  select 1 from public.yb_yearbooks y where y.id=yearbook_id
  and public.yb_has_school_role(y.school_id,array['school_admin'])
 ));
create policy yb_access_membership_admin_manage on public.yb_access_memberships
 for all to authenticated using(exists(
  select 1 from public.yb_access_groups g where g.id=access_group_id
  and public.yb_has_school_role(g.school_id,array['school_admin'])
 )) with check(exists(
  select 1 from public.yb_access_groups g where g.id=access_group_id
  and public.yb_has_school_role(g.school_id,array['school_admin'])
 ));
