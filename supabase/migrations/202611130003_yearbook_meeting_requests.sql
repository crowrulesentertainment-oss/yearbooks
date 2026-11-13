-- Secure adult-contact inquiry intake for video yearbook production meetings.
create table if not exists public.cr_yearbook_meeting_requests (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique default ('YB-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  contact_name text not null,
  position text,
  organization_name text not null,
  email text not null,
  phone text,
  school_type text,
  city text,
  target_year text,
  services text not null,
  message text,
  consent_to_contact boolean not null default false,
  status text not null default 'new' check(status in('new','reviewing','contacted','meeting_scheduled','proposal_sent','accepted','declined','closed','spam')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cr_yearbook_meeting_requests_status_idx
 on public.cr_yearbook_meeting_requests(status,created_at desc);
alter table public.cr_yearbook_meeting_requests enable row level security;
revoke all on public.cr_yearbook_meeting_requests from anon,authenticated;
grant select,update,delete on public.cr_yearbook_meeting_requests to authenticated;
create policy cr_yearbook_meeting_requests_admin_manage
 on public.cr_yearbook_meeting_requests for all to authenticated
 using ((select private.cr_universal_admin_check()))
 with check ((select private.cr_universal_admin_check()));

create table if not exists public.cr_yearbook_meeting_rate_limits (
  ip_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
);
alter table public.cr_yearbook_meeting_rate_limits enable row level security;
revoke all on public.cr_yearbook_meeting_rate_limits from public,anon,authenticated;

create or replace function private.cr_yearbook_allow_meeting_request(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare v_count integer;
begin
  if p_ip_hash is null or length(p_ip_hash)<32 then return false; end if;
  insert into public.cr_yearbook_meeting_rate_limits(ip_hash,window_started_at,request_count)
  values(p_ip_hash,now(),1)
  on conflict(ip_hash) do update
  set window_started_at=case
        when public.cr_yearbook_meeting_rate_limits.window_started_at < now()-interval '1 hour' then now()
        else public.cr_yearbook_meeting_rate_limits.window_started_at end,
      request_count=case
        when public.cr_yearbook_meeting_rate_limits.window_started_at < now()-interval '1 hour' then 1
        else public.cr_yearbook_meeting_rate_limits.request_count+1 end
  returning request_count into v_count;
  return v_count<=3;
end;
$function$;
revoke all on function private.cr_yearbook_allow_meeting_request(text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.cr_yearbook_allow_meeting_request(text) to service_role;

create or replace function public.cr_yearbook_allow_meeting_request(p_ip_hash text)
returns boolean
language sql
security invoker
set search_path=''
as $function$
 select private.cr_yearbook_allow_meeting_request(p_ip_hash);
$function$;
revoke all on function public.cr_yearbook_allow_meeting_request(text) from public,anon,authenticated;
grant execute on function public.cr_yearbook_allow_meeting_request(text) to service_role;
