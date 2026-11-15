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
