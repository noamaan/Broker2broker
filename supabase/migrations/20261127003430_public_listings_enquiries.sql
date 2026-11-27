-- Public visibility is explicit and defaults to private for all existing listings.
alter table public.listings add column if not exists is_public boolean not null default false;
create index if not exists listings_public_browse_idx on public.listings (is_public, status, reconfirm_due_at, created_at desc);

create table if not exists public.enquiries (
  enquiry_id text primary key,
  listing_id text not null references public.listings(listing_id),
  sender_id text not null references public.users(user_id),
  recipient_id text not null references public.users(user_id),
  message text not null check (length(trim(message)) between 10 and 1000),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index if not exists enquiries_sender_idx on public.enquiries (sender_id, created_at desc);
create index if not exists enquiries_recipient_idx on public.enquiries (recipient_id, created_at desc);
alter table public.enquiries enable row level security;
revoke all on public.enquiries from public, anon, authenticated;
grant select, insert, update, delete on public.enquiries to service_role;

-- Enquiry and notification commit together. Membership and listing visibility are checked in the database.
create or replace function public.b2b_create_enquiry(p_actor_id text, p_listing_id text, p_message text)
returns text language plpgsql security definer set search_path = public as $$
declare v_actor public.users%rowtype; v_listing public.listings%rowtype; v_id text;
begin
  select * into v_actor from public.users where user_id=p_actor_id and account_status='ACTIVE';
  if not found or v_actor.membership_status <> 'ACTIVE' or v_actor.membership_expires_at is null or v_actor.membership_expires_at <= now() then
    raise exception using errcode='P0001', message='MEMBERSHIP_REQUIRED: An active approved membership is required.';
  end if;
  if length(trim(coalesce(p_message,''))) < 10 or length(trim(p_message)) > 1000 then
    raise exception using errcode='P0001', message='INVALID_INPUT: Enter an enquiry between 10 and 1000 characters.';
  end if;
  select l.* into v_listing from public.listings l join public.users u on u.user_id=l.owner_id
    where l.listing_id=p_listing_id and l.status='ACTIVE' and l.reconfirm_due_at > now() and u.account_status='ACTIVE';
  if not found then raise exception using errcode='P0001', message='NOT_FOUND: This listing is not currently available.'; end if;
  if v_listing.owner_id=p_actor_id then raise exception using errcode='P0001', message='INVALID_INPUT: You cannot enquire about your own listing.'; end if;
  v_id := 'ENQ-' || upper(replace(gen_random_uuid()::text,'-',''));
  insert into public.enquiries(enquiry_id,listing_id,sender_id,recipient_id,message) values(v_id,p_listing_id,p_actor_id,v_listing.owner_id,trim(p_message));
  insert into public.notifications(notification_id,user_id,type,title,body,related_id)
  values('NTF-'||upper(replace(gen_random_uuid()::text,'-','')),v_listing.owner_id,'ENQUIRY_RECEIVED','New property enquiry','A broker has sent you an enquiry. Open your enquiries to view it.',v_id);
  return v_id;
end;
$$;
revoke all on function public.b2b_create_enquiry(text,text,text) from public, anon, authenticated;
grant execute on function public.b2b_create_enquiry(text,text,text) to service_role;

-- Include enquiries in the existing private, consistent snapshot; browser subscriptions are intentionally excluded.
-- Read one transactionally consistent, private snapshot for the server-side backup workflow.
create or replace function public.b2b_export_snapshot()
returns jsonb
language sql stable security definer set search_path=public
as $$
  select jsonb_build_object(
    'users',coalesce((select jsonb_agg(to_jsonb(r) order by r.user_id) from public.users r),'[]'::jsonb),
    'broker_profiles',coalesce((select jsonb_agg(to_jsonb(r) order by r.profile_id) from public.broker_profiles r),'[]'::jsonb),
    'listings',coalesce((select jsonb_agg(to_jsonb(r) order by r.listing_id) from public.listings r),'[]'::jsonb),
    'payment_requests',coalesce((select jsonb_agg(to_jsonb(r) order by r.request_id) from public.payment_requests r),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(to_jsonb(r) order by r.payment_id) from public.payments r),'[]'::jsonb),
    'subscriptions',coalesce((select jsonb_agg(to_jsonb(r) order by r.subscription_id) from public.subscriptions r),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(to_jsonb(r) order by r.category_id) from public.categories r),'[]'::jsonb),
    'localities',coalesce((select jsonb_agg(to_jsonb(r) order by r.locality_id) from public.localities r),'[]'::jsonb),
    'favourites',coalesce((select jsonb_agg(to_jsonb(r) order by r.favourite_id) from public.favourites r),'[]'::jsonb),
    'reports',coalesce((select jsonb_agg(to_jsonb(r) order by r.report_id) from public.reports r),'[]'::jsonb),
    'enquiries',coalesce((select jsonb_agg(to_jsonb(r) order by r.enquiry_id) from public.enquiries r),'[]'::jsonb),
    'notifications',coalesce((select jsonb_agg(to_jsonb(r) order by r.notification_id) from public.notifications r),'[]'::jsonb),
    'admins',coalesce((select jsonb_agg(to_jsonb(r) order by r.admin_id) from public.admins r),'[]'::jsonb),
    'developers',coalesce((select jsonb_agg(to_jsonb(r) order by r.developer_id) from public.developers r),'[]'::jsonb),
    'settings',coalesce((select jsonb_agg(to_jsonb(r) order by r.setting_id) from public.settings r),'[]'::jsonb),
    'audit_logs',coalesce((select jsonb_agg(to_jsonb(r) order by r.audit_id) from public.audit_logs r),'[]'::jsonb),
    'security_logs',coalesce((select jsonb_agg(to_jsonb(r) order by r.security_log_id) from public.security_logs r),'[]'::jsonb),
    'file_assets',coalesce((select jsonb_agg(to_jsonb(r) order by r.file_id) from public.file_assets r),'[]'::jsonb),
    'platform_config',coalesce((select jsonb_agg(to_jsonb(r) order by r.key) from public.platform_config r),'[]'::jsonb)
  );
$$;
revoke all on function public.b2b_export_snapshot() from public, anon, authenticated;
grant execute on function public.b2b_export_snapshot() to service_role;
