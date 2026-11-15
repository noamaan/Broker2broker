-- Atomic server-side operations and private snapshot storage for the Next.js backend.

-- Normalize references consistently even if whitespace reaches the database.
drop index if exists public.payment_requests_utr_uq;
create unique index payment_requests_utr_uq
  on public.payment_requests (upper(regexp_replace(upi_transaction_id, '[[:space:]]+', '', 'g')));
drop index if exists public.payments_utr_uq;
create unique index payments_utr_uq
  on public.payments (upper(regexp_replace(upi_transaction_id, '[[:space:]]+', '', 'g')));
create unique index if not exists payment_requests_one_open_per_user_uq
  on public.payment_requests (user_id)
  where status in ('PENDING VERIFICATION','MORE INFO REQUIRED');
create index if not exists rate_limit_events_created_idx on public.rate_limit_events (created_at);

create table if not exists public.database_backups (
  backup_id text primary key,
  created_by text not null,
  bucket text not null default 'b2b-private-backups',
  storage_path text not null unique,
  file_name text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);
alter table public.database_backups enable row level security;
revoke all on public.database_backups from anon, authenticated;
grant select, insert, update, delete on public.database_backups to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('b2b-private-backups','b2b-private-backups',false,50000000,array['application/json'])
on conflict (id) do update set public=false, file_size_limit=50000000, allowed_mime_types=array['application/json'];

create or replace function public.b2b_check_rate_limit(
  p_action text,
  p_subject_hash text,
  p_max_requests integer,
  p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_start timestamptz := now() - make_interval(secs => greatest(1, p_window_seconds));
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_action), hashtext(p_subject_hash));
  delete from public.rate_limit_events
    where action = p_action and subject_hash = p_subject_hash and created_at < v_start;
  select count(*) into v_count from public.rate_limit_events
    where action = p_action and subject_hash = p_subject_hash and created_at >= v_start;
  if v_count >= greatest(1, p_max_requests) then
    return false;
  end if;
  insert into public.rate_limit_events(action, subject_hash) values (p_action, p_subject_hash);
  -- Keep the operational rate-limit table bounded without requiring a paid scheduler.
  delete from public.rate_limit_events where created_at < now() - interval '7 days';
  return true;
end;
$$;

create or replace function public.b2b_register_user(p_data jsonb)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id text := p_data->>'user_id';
  v_now timestamptz := now();
begin
  if coalesce(v_user_id,'') = '' or coalesce(p_data->>'email','') = '' then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT: Account details are incomplete.';
  end if;
  insert into public.users(
    user_id,full_name,mobile,email,password_hash,password_salt,agency_name,whatsapp_number,city,
    preferred_localities,role,account_status,membership_status,current_plan,created_at,updated_at
  ) values (
    v_user_id,coalesce(p_data->>'full_name',''),coalesce(p_data->>'mobile',''),lower(p_data->>'email'),
    p_data->>'password_hash',p_data->>'password_salt',coalesce(p_data->>'agency_name',''),
    coalesce(p_data->>'whatsapp_number',''),coalesce(p_data->>'city',''),
    coalesce(p_data->'preferred_localities','[]'::jsonb),'USER','ACTIVE','FREE ACCOUNT','FREE',v_now,v_now
  );
  insert into public.broker_profiles(profile_id,user_id,bio,languages,specialties,is_verified,created_at,updated_at)
  values (p_data->>'profile_id',v_user_id,'','[]'::jsonb,'[]'::jsonb,false,v_now,v_now);
  insert into public.audit_logs(audit_id,actor_id,action,entity_type,entity_id,details,created_at)
  values (p_data->>'audit_id',v_user_id,'USER_REGISTERED','USER',v_user_id,jsonb_build_object('email',lower(p_data->>'email')),v_now);
  return v_user_id;
end;
$$;

create or replace function public.b2b_bootstrap_developer(p_data jsonb)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id text := p_data->>'user_id';
  v_email text := lower(coalesce(p_data->>'email',''));
  v_now timestamptz := now();
begin
  update public.platform_config set value='used',updated_at=v_now
    where key='developer_bootstrap_state' and value='unused';
  if not found then
    raise exception using errcode = 'P0001', message = 'CONFLICT: Developer setup is already closed.';
  end if;
  if exists(select 1 from public.developers where status='ACTIVE') then
    raise exception using errcode = 'P0001', message = 'CONFLICT: A developer account has already been created.';
  end if;
  if exists(select 1 from public.users where lower(email)=v_email) then
    raise exception using errcode = 'P0001', message = 'CONFLICT: An account already exists for this email.';
  end if;
  if v_user_id is null or v_email='' then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT: Developer account details are invalid.';
  end if;
  insert into public.users(
    user_id,full_name,mobile,email,password_hash,password_salt,agency_name,whatsapp_number,city,
    preferred_localities,role,account_status,membership_status,current_plan,created_at,updated_at
  ) values (
    v_user_id,coalesce(p_data->>'full_name',''),coalesce(p_data->>'mobile',''),v_email,
    p_data->>'password_hash',p_data->>'password_salt','Broker2Broker Platform',coalesce(p_data->>'mobile',''),
    'India','[]'::jsonb,'DEVELOPER','ACTIVE','FREE ACCOUNT','FREE',v_now,v_now
  );
  insert into public.broker_profiles(profile_id,user_id,bio,languages,specialties,is_verified,verified_by,verified_at,created_at,updated_at)
  values (p_data->>'profile_id',v_user_id,'Platform developer','[]'::jsonb,'[]'::jsonb,true,v_user_id,v_now,v_now,v_now);
  insert into public.developers(developer_id,user_id,email,status,created_at)
  values (p_data->>'developer_id',v_user_id,v_email,'ACTIVE',v_now);
  update public.platform_config set value=v_user_id,updated_at=v_now where key='developer_user_id';
  insert into public.audit_logs(audit_id,actor_id,action,entity_type,entity_id,details,created_at)
  values (p_data->>'audit_id',v_user_id,'DEVELOPER_BOOTSTRAPPED','DEVELOPER',v_user_id,jsonb_build_object('email',v_email),v_now);
  return v_user_id;
end;
$$;

create or replace function public.b2b_create_payment_request(
  p_actor_id text,
  p_request_id text,
  p_utr text,
  p_payment_date date,
  p_plan text,
  p_expected_amount numeric,
  p_screenshot_file_id text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_request public.payment_requests%rowtype;
  v_file public.file_assets%rowtype;
  v_amount numeric;
  v_days integer;
  v_now timestamptz := now();
  v_upi text;
  v_payee text;
  v_whatsapp text;
begin
  select * into v_user from public.users where user_id=p_actor_id for update;
  if not found or v_user.account_status <> 'ACTIVE' or v_user.role not in ('USER','ADMIN','DEVELOPER') then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN: This account is not active or authorized.';
  end if;
  select value into v_upi from public.settings where key='payment.upiId';
  select value into v_payee from public.settings where key='payment.payeeName';
  select value into v_whatsapp from public.settings where key='payment.whatsappNumber';
  if coalesce(v_upi,'')='' or coalesce(v_payee,'')='' or coalesce(v_whatsapp,'')='' then
    raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_CONFIGURED: The administrator has not configured UPI and WhatsApp payment details yet.';
  end if;
  if p_plan='MONTHLY' then
    select coalesce(nullif(value,''),'199')::numeric into v_amount from public.settings where key='payment.monthlyPrice';
    if v_amount is null then v_amount := 199; end if;
    select coalesce(nullif(value,''),'30')::integer into v_days from public.settings where key='payment.monthlyDurationDays';
    if v_days is null then v_days := 30; end if;
  elsif p_plan='YEARLY' then
    select coalesce(nullif(value,''),'1999')::numeric into v_amount from public.settings where key='payment.yearlyPrice';
    if v_amount is null then v_amount := 1999; end if;
    select coalesce(nullif(value,''),'365')::integer into v_days from public.settings where key='payment.yearlyDurationDays';
    if v_days is null then v_days := 365; end if;
  else
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT: Select a valid membership plan.';
  end if;
  if p_expected_amount <> v_amount then
    raise exception using errcode = 'P0001', message = 'CONFLICT: The membership price changed. Refresh the payment page and verify the new amount before submitting.';
  end if;
  if p_utr !~ '^[A-Z0-9./-]+$' or length(p_utr)<6 or length(p_utr)>80 then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT: Enter a valid UPI transaction reference.';
  end if;
  if p_payment_date > (v_now::date + 1) or p_payment_date < (v_now::date - 180) then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT: Payment date must be within the last 180 days and not in the future.';
  end if;
  if exists(select 1 from public.payment_requests where user_id=p_actor_id and status in ('PENDING VERIFICATION','MORE INFO REQUIRED')) then
    raise exception using errcode = 'P0001', message = 'CONFLICT: You already have a payment request awaiting review. Wait for an admin response before submitting another.';
  end if;
  if coalesce(p_screenshot_file_id,'')<>'' then
    select * into v_file from public.file_assets where file_id=p_screenshot_file_id and owner_id=p_actor_id and purpose='PAYMENT_PROOF' and active=true for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'INVALID_INPUT: Payment screenshot reference is invalid.';
    end if;
  end if;
  insert into public.payment_requests(
    request_id,user_id,full_name,mobile,email,agency_name,subscription_plan,amount,upi_transaction_id,
    payment_date,request_date,status,admin_notes,screenshot_file_id,duration_days,whatsapp_number,created_at,updated_at
  ) values (
    p_request_id,v_user.user_id,v_user.full_name,v_user.mobile,v_user.email,v_user.agency_name,p_plan,v_amount,p_utr,
    p_payment_date,v_now,'PENDING VERIFICATION','',nullif(p_screenshot_file_id,''),v_days,v_user.whatsapp_number,v_now,v_now
  ) returning * into v_request;
  if coalesce(p_screenshot_file_id,'')<>'' then
    update public.file_assets set related_id=p_request_id where file_id=p_screenshot_file_id;
  end if;
  insert into public.audit_logs(audit_id,actor_id,action,entity_type,entity_id,details,created_at)
  values ('AUD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),p_actor_id,'PAYMENT_REQUEST_CREATED','PAYMENT_REQUEST',p_request_id,jsonb_build_object('plan',p_plan,'amount',v_amount),v_now);
  insert into public.notifications(notification_id,user_id,type,title,body,related_id,created_at)
  values ('NTF-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),p_actor_id,'PAYMENT_PENDING','Payment request submitted',
    'Your '||lower(p_plan)||' membership request is pending manual verification.',p_request_id,v_now);
  return to_jsonb(v_request);
end;
$$;

create or replace function public.b2b_payment_decision(
  p_actor_id text,
  p_request_id text,
  p_action text,
  p_notes text,
  p_actual_credit_verified boolean,
  p_payment_id text,
  p_subscription_id text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor public.users%rowtype;
  v_request public.payment_requests%rowtype;
  v_user public.users%rowtype;
  v_now timestamptz := now();
  v_renewal boolean;
  v_starts timestamptz;
  v_expires timestamptz;
begin
  select * into v_actor from public.users where user_id=p_actor_id and account_status='ACTIVE' and role in ('ADMIN','DEVELOPER');
  if not found then raise exception using errcode='P0001', message='FORBIDDEN: You do not have permission for this action.'; end if;
  if v_actor.role='DEVELOPER' and not exists(select 1 from public.platform_config where key='developer_user_id' and value=p_actor_id) then
    raise exception using errcode='P0001', message='FORBIDDEN: Only the original developer account can access this function.';
  end if;
  if p_action not in ('APPROVE','REJECT','REQUEST_INFO') then
    raise exception using errcode='P0001', message='INVALID_INPUT: Choose a valid review action.';
  end if;
  if p_action<>'APPROVE' and coalesce(trim(p_notes),'')='' then
    raise exception using errcode='P0001', message='INVALID_INPUT: Add a reason or information request note.';
  end if;
  if p_action='APPROVE' and p_actual_credit_verified is not true then
    raise exception using errcode='P0001', message='FORBIDDEN: Confirm that actual UPI credit was independently verified before approval.';
  end if;
  select * into v_request from public.payment_requests where request_id=p_request_id for update;
  if not found then raise exception using errcode='P0001', message='NOT_FOUND: Payment request was not found.'; end if;
  if v_request.user_id=p_actor_id then raise exception using errcode='P0001', message='FORBIDDEN: You cannot review your own payment request.'; end if;
  if v_request.status not in ('PENDING VERIFICATION','MORE INFO REQUIRED') then
    raise exception using errcode='P0001', message='CONFLICT: This payment request has already been reviewed.';
  end if;
  if p_action in ('REQUEST_INFO','REJECT') then
    update public.payment_requests set status=case when p_action='REQUEST_INFO' then 'MORE INFO REQUIRED' else 'REJECTED' end,
      admin_notes=trim(p_notes),reviewed_by=p_actor_id,reviewed_at=v_now,updated_at=v_now
      where request_id=p_request_id returning * into v_request;
    if p_action='REQUEST_INFO' then
      insert into public.notifications(notification_id,user_id,type,title,body,related_id,created_at)
      values ('NTF-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),v_request.user_id,'PAYMENT_INFO_REQUIRED','More information requested',trim(p_notes),p_request_id,v_now);
      insert into public.audit_logs(audit_id,actor_id,action,entity_type,entity_id,details,created_at)
      values ('AUD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),p_actor_id,'PAYMENT_INFO_REQUESTED','PAYMENT_REQUEST',p_request_id,jsonb_build_object('notes',trim(p_notes)),v_now);
    else
      insert into public.notifications(notification_id,user_id,type,title,body,related_id,created_at)
      values ('NTF-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),v_request.user_id,'PAYMENT_REJECTED','Payment request not approved',trim(p_notes),p_request_id,v_now);
      insert into public.audit_logs(audit_id,actor_id,action,entity_type,entity_id,details,created_at)
      values ('AUD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),p_actor_id,'PAYMENT_REJECTED','PAYMENT_REQUEST',p_request_id,jsonb_build_object('reason',trim(p_notes)),v_now);
    end if;
    return jsonb_build_object('request',to_jsonb(v_request));
  end if;
  select * into v_user from public.users where user_id=v_request.user_id for update;
  if not found or v_user.account_status<>'ACTIVE' then
    raise exception using errcode='P0001', message='FORBIDDEN: This member account is not active.';
  end if;
  if exists(select 1 from public.payments where request_id=p_request_id or upper(regexp_replace(upi_transaction_id,'[[:space:]]+','','g'))=upper(regexp_replace(v_request.upi_transaction_id,'[[:space:]]+','','g'))) then
    raise exception using errcode='P0001', message='CONFLICT: A payment record already exists for this request or UTR.';
  end if;
  v_renewal := v_user.membership_status='ACTIVE' and v_user.membership_expires_at is not null and v_user.membership_expires_at>v_now;
  v_starts := case when v_renewal then v_user.membership_expires_at else v_now end;
  v_expires := v_starts + make_interval(days=>v_request.duration_days);
  update public.subscriptions set status='RENEWED'
    where user_id=v_user.user_id and status='ACTIVE' and expires_at>v_now;
  insert into public.payments(payment_id,request_id,user_id,plan,amount,upi_transaction_id,payment_date,status,verified_by,verified_at,created_at)
  values (p_payment_id,p_request_id,v_user.user_id,v_request.subscription_plan,v_request.amount,v_request.upi_transaction_id,v_request.payment_date,'APPROVED',p_actor_id,v_now,v_now);
  insert into public.subscriptions(subscription_id,user_id,payment_request_id,payment_id,plan,amount,duration_days,status,starts_at,expires_at,approved_by,renewal_type,created_at)
  values (p_subscription_id,v_user.user_id,p_request_id,p_payment_id,v_request.subscription_plan,v_request.amount,v_request.duration_days,'ACTIVE',v_starts,v_expires,p_actor_id,case when v_renewal then 'RENEWAL' else 'NEW' end,v_now);
  update public.payment_requests set status='APPROVED',admin_notes=trim(coalesce(p_notes,'')),reviewed_by=p_actor_id,reviewed_at=v_now,
    approved_by=p_actor_id,approval_date=v_now,updated_at=v_now where request_id=p_request_id returning * into v_request;
  update public.users set membership_status='ACTIVE',current_plan=v_request.subscription_plan,membership_start_at=v_starts,membership_expires_at=v_expires,updated_at=v_now
    where user_id=v_user.user_id;
  insert into public.notifications(notification_id,user_id,type,title,body,related_id,created_at)
  values ('NTF-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),v_user.user_id,'MEMBERSHIP_ACTIVATED','Membership activated',
    'Your '||lower(v_request.subscription_plan)||' membership is active until '||to_char(v_expires at time zone 'UTC','YYYY-MM-DD')||'.',p_request_id,v_now);
  insert into public.audit_logs(audit_id,actor_id,action,entity_type,entity_id,details,created_at)
  values ('AUD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),p_actor_id,'PAYMENT_APPROVED','PAYMENT_REQUEST',p_request_id,
    jsonb_build_object('paymentID',p_payment_id,'subscriptionID',p_subscription_id,'startsAt',v_starts,'expiresAt',v_expires,'amount',v_request.amount,'actualCreditVerified',p_actual_credit_verified),v_now);
  return jsonb_build_object('request',to_jsonb(v_request),'payment_id',p_payment_id,'subscription_id',p_subscription_id,'starts_at',v_starts,'expires_at',v_expires);
end;
$$;

create or replace function public.b2b_password_reset_complete(
  p_token_hash text,
  p_password_hash text,
  p_password_salt text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_now timestamptz := now();
begin
  select * into v_user from public.users where password_reset_hash=p_token_hash and password_reset_expires_at>v_now for update;
  if not found then raise exception using errcode='P0001', message='INVALID_TOKEN: This password reset link is invalid or expired.'; end if;
  update public.users set password_hash=p_password_hash,password_salt=p_password_salt,password_reset_hash=null,password_reset_expires_at=null,updated_at=v_now
    where user_id=v_user.user_id;
  insert into public.audit_logs(audit_id,actor_id,action,entity_type,entity_id,details,created_at)
  values ('AUD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),v_user.user_id,'PASSWORD_RESET','USER',v_user.user_id,'{}'::jsonb,v_now);
  insert into public.security_logs(security_log_id,actor_id,event_type,subject,details,created_at)
  values ('SEC-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),v_user.user_id,'PASSWORD_RESET_COMPLETED',v_user.email,'{}'::jsonb,v_now);
  return jsonb_build_object('user_id',v_user.user_id,'email',v_user.email);
end;
$$;

create or replace function public.b2b_set_admin_role(
  p_actor_id text,
  p_user_id text,
  p_action text,
  p_reason text
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_actor public.users%rowtype;
  v_target public.users%rowtype;
  v_role text;
  v_now timestamptz := now();
begin
  select * into v_actor from public.users where user_id=p_actor_id and role='DEVELOPER' and account_status='ACTIVE';
  if not found or not exists(select 1 from public.platform_config where key='developer_user_id' and value=p_actor_id) then
    raise exception using errcode='P0001', message='FORBIDDEN: Only the original developer account can access this function.';
  end if;
  select * into v_target from public.users where user_id=p_user_id for update;
  if not found then raise exception using errcode='P0001', message='NOT_FOUND: Account not found.'; end if;
  if p_user_id=p_actor_id or v_target.role='DEVELOPER' then
    raise exception using errcode='P0001', message='FORBIDDEN: The original developer account is exclusive and cannot be changed.';
  end if;
  if p_action not in ('MAKE_ADMIN','REMOVE_ADMIN') then
    raise exception using errcode='P0001', message='INVALID_INPUT: Invalid administrator action.';
  end if;
  v_role := case when p_action='MAKE_ADMIN' then 'ADMIN' else 'USER' end;
  update public.users set role=v_role,updated_at=v_now where user_id=p_user_id;
  if v_role='ADMIN' then
    insert into public.admins(admin_id,user_id,email,status,created_at,updated_at)
      values ('ADM-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),p_user_id,v_target.email,'ACTIVE',v_now,v_now)
      on conflict (user_id) do update set email=excluded.email,status='ACTIVE',updated_at=excluded.updated_at;
  else
    update public.admins set status='REVOKED',updated_at=v_now where user_id=p_user_id;
  end if;
  insert into public.audit_logs(audit_id,actor_id,action,entity_type,entity_id,details,created_at)
  values ('AUD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),p_actor_id,'DEVELOPER_ADMIN_ROLE_CHANGED','USER',p_user_id,
    jsonb_build_object('action',p_action,'reason',coalesce(p_reason,'')),v_now);
  insert into public.notifications(notification_id,user_id,type,title,body,related_id,created_at)
  values ('NTF-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),p_user_id,'ADMIN_ROLE','Account role updated',
    case when v_role='ADMIN' then 'You have been granted administrator access.' else 'Your administrator access has been removed.' end,'',v_now);
  return p_user_id;
end;
$$;

create or replace function public.b2b_reconfirm_due_listings()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_listing record;
  v_count integer := 0;
  v_now timestamptz := now();
begin
  for v_listing in
    update public.listings set status='UNDER_REVIEW',updated_at=v_now
      where status='ACTIVE' and reconfirm_due_at is not null and reconfirm_due_at<=v_now
      returning listing_id,owner_id,title
  loop
    insert into public.notifications(notification_id,user_id,type,title,body,related_id,created_at)
    values ('NTF-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),v_listing.owner_id,'LISTING_RECONFIRMATION','Confirm listing availability',
      'Your listing '||v_listing.title||' needs availability reconfirmation before it appears in search.',v_listing.listing_id,v_now);
    insert into public.audit_logs(audit_id,actor_id,action,entity_type,entity_id,details,created_at)
    values ('AUD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),'SYSTEM','LISTING_REQUIRES_RECONFIRMATION','LISTING',v_listing.listing_id,'{}'::jsonb,v_now);
    v_count := v_count + 1;
  end loop;
  delete from public.request_nonces where expires_at<=v_now;
  return v_count;
end;
$$;

-- These procedures are not callable by browser roles. Next.js alone uses the server-only secret key.
revoke all on function public.b2b_check_rate_limit(text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.b2b_register_user(jsonb) from public, anon, authenticated;
revoke all on function public.b2b_bootstrap_developer(jsonb) from public, anon, authenticated;
revoke all on function public.b2b_create_payment_request(text,text,text,date,text,numeric,text) from public, anon, authenticated;
revoke all on function public.b2b_payment_decision(text,text,text,text,boolean,text,text) from public, anon, authenticated;
revoke all on function public.b2b_password_reset_complete(text,text,text) from public, anon, authenticated;
revoke all on function public.b2b_set_admin_role(text,text,text,text) from public, anon, authenticated;
revoke all on function public.b2b_reconfirm_due_listings() from public, anon, authenticated;
grant execute on function public.b2b_check_rate_limit(text,text,integer,integer) to service_role;
grant execute on function public.b2b_register_user(jsonb) to service_role;
grant execute on function public.b2b_bootstrap_developer(jsonb) to service_role;
grant execute on function public.b2b_create_payment_request(text,text,text,date,text,numeric,text) to service_role;
grant execute on function public.b2b_payment_decision(text,text,text,text,boolean,text,text) to service_role;
grant execute on function public.b2b_password_reset_complete(text,text,text) to service_role;
grant execute on function public.b2b_set_admin_role(text,text,text,text) to service_role;
grant execute on function public.b2b_reconfirm_due_listings() to service_role;
