-- New monthly requests use the fixed price and term. Existing requests, subscriptions and payments remain unchanged.
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
    v_amount := 199;
    v_days := 30;
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
revoke all on function public.b2b_create_payment_request(text,text,text,date,text,numeric,text) from public, anon, authenticated;
grant execute on function public.b2b_create_payment_request(text,text,text,date,text,numeric,text) to service_role;
