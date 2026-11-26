-- Browser subscriptions are private, service-role only, and tied to an account.
create table public.push_subscriptions (
  subscription_id text primary key,
  user_id text not null references public.users(user_id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);
create table public.push_queue (
  queue_id bigint generated always as identity primary key,
  subscription_id text not null references public.push_subscriptions(subscription_id) on delete cascade,
  notification_id text not null references public.notifications(notification_id) on delete cascade,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  unique (subscription_id, notification_id)
);
create index push_queue_available_idx on public.push_queue(available_at);
alter table public.push_subscriptions enable row level security;
alter table public.push_queue enable row level security;
revoke all on public.push_subscriptions, public.push_queue from public, anon, authenticated;
grant all on public.push_subscriptions, public.push_queue to service_role;
grant usage, select on sequence public.push_queue_queue_id_seq to service_role;

create or replace function public.b2b_queue_push() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.push_queue(subscription_id,notification_id)
    select subscription_id,new.notification_id from public.push_subscriptions where user_id=new.user_id
    on conflict do nothing;
  return new;
end;
$$;
create trigger b2b_queue_notification_push after insert on public.notifications for each row execute function public.b2b_queue_push();
revoke all on function public.b2b_queue_push() from public, anon, authenticated;

-- Claim with a lease so retries and concurrent cron invocations cannot pick the same job.
create or replace function public.b2b_claim_push(p_limit integer default 50)
returns table(queue_id bigint, subscription_id text, endpoint text, p256dh text, auth_key text, attempts integer)
language sql security definer set search_path=public as $$
  with picked as (
    select q.queue_id from public.push_queue q
    join public.push_subscriptions s on s.subscription_id=q.subscription_id
    join public.users u on u.user_id=s.user_id
    where q.available_at <= now() and q.attempts < 5 and u.account_status='ACTIVE'
    order by q.queue_id for update of q skip locked limit greatest(1,least(p_limit,50))
  ), claimed as (
    update public.push_queue q set available_at=now()+interval '10 minutes', attempts=q.attempts+1
    from picked where q.queue_id=picked.queue_id returning q.*
  )
  select c.queue_id,s.subscription_id,s.endpoint,s.p256dh,s.auth_key,c.attempts from claimed c
  join public.push_subscriptions s on s.subscription_id=c.subscription_id;
$$;
revoke all on function public.b2b_claim_push(integer) from public, anon, authenticated;
grant execute on function public.b2b_claim_push(integer) to service_role;
