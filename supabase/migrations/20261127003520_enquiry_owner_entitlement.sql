-- A listing must belong to an active member when an enquiry is sent.
create or replace function public.b2b_create_enquiry(p_actor_id text, p_listing_id text, p_message text)
returns text language plpgsql security definer set search_path = public as $$
declare v_actor public.users%rowtype; v_listing public.listings%rowtype; v_id text;
begin
  select * into v_actor from public.users where user_id=p_actor_id and account_status='ACTIVE';
  if not found or v_actor.membership_status is distinct from 'ACTIVE' or v_actor.membership_expires_at is null or v_actor.membership_expires_at <= now() then
    raise exception using errcode='P0001', message='MEMBERSHIP_REQUIRED: An active approved membership is required.';
  end if;
  if length(trim(coalesce(p_message,''))) < 10 or length(trim(p_message)) > 1000 then
    raise exception using errcode='P0001', message='INVALID_INPUT: Enter an enquiry between 10 and 1000 characters.';
  end if;
  select l.* into v_listing from public.listings l join public.users u on u.user_id=l.owner_id
    where l.listing_id=p_listing_id and l.status='ACTIVE' and l.reconfirm_due_at > now() and u.account_status='ACTIVE' and u.membership_status='ACTIVE' and u.membership_expires_at > now();
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

