-- One in-app reminder per membership expiry, even if the cron job retries.
create or replace function public.b2b_membership_reminders()
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_count integer;
begin
  insert into public.notifications(notification_id, user_id, type, title, body, related_id, created_at)
  select 'RENEW-' || md5(u.user_id || ':' || extract(epoch from u.membership_expires_at)::text),
    u.user_id, 'MEMBERSHIP_EXPIRING', 'Membership renewal reminder',
    'Your membership expires on ' || to_char(u.membership_expires_at at time zone 'Asia/Kolkata', 'DD Mon YYYY') || '. Visit Membership to submit a renewal for manual review.',
    '', now()
  from public.users u
  where u.account_status = 'ACTIVE' and u.membership_status = 'ACTIVE'
    and u.membership_expires_at > now() and u.membership_expires_at <= now() + interval '7 days'
  on conflict (notification_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.b2b_membership_reminders() from public, anon, authenticated;
grant execute on function public.b2b_membership_reminders() to service_role;
