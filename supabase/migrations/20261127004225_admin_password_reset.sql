-- Existing sessions remain valid until that particular account completes a reset.
alter table public.users add column session_version integer not null default 0;

-- Only an active admin may issue a link for a normal user. The original
-- developer may also issue links for admins, but nobody can reset the developer.
create or replace function public.b2b_admin_issue_password_reset(p_actor_id text, p_user_id text, p_token_hash text)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor public.users%rowtype; v_target public.users%rowtype; v_now timestamptz := now();
begin
  select * into v_actor from public.users where user_id=p_actor_id and account_status='ACTIVE';
  if not found or v_actor.role not in ('ADMIN','DEVELOPER') then
    raise exception using errcode='P0001', message='FORBIDDEN: Only an active administrator can issue reset links.';
  end if;
  if v_actor.role='DEVELOPER' and (not exists(select 1 from public.platform_config where key='developer_user_id' and value=p_actor_id) or not exists(select 1 from public.developers where user_id=p_actor_id and status='ACTIVE')) then
    raise exception using errcode='P0001', message='FORBIDDEN: Developer identity is not valid.';
  end if;
  select * into v_target from public.users where user_id=p_user_id for update;
  if not found then raise exception using errcode='P0001', message='NOT_FOUND: Account not found.'; end if;
  if p_user_id=p_actor_id or v_target.account_status<>'ACTIVE' or v_target.role='DEVELOPER' or (v_target.role<>'USER' and v_actor.role<>'DEVELOPER') then
    raise exception using errcode='P0001', message='FORBIDDEN: You cannot reset this account.';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='P0001', message='INVALID_INPUT: Invalid reset token.';
  end if;
  update public.users set password_reset_hash=p_token_hash,password_reset_expires_at=v_now+interval '30 minutes',updated_at=v_now where user_id=p_user_id;
  insert into public.audit_logs(audit_id,actor_id,action,entity_type,entity_id,details,created_at)
  values ('AUD-'||upper(replace(gen_random_uuid()::text,'-','')),p_actor_id,'ADMIN_PASSWORD_RESET_LINK_ISSUED','USER',p_user_id,'{}'::jsonb,v_now);
end;
$$;
revoke all on function public.b2b_admin_issue_password_reset(text,text,text) from public, anon, authenticated;
grant execute on function public.b2b_admin_issue_password_reset(text,text,text) to service_role;

create or replace function public.b2b_password_reset_complete(p_token_hash text,p_password_hash text,p_password_salt text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user public.users%rowtype; v_now timestamptz := now();
begin
  select * into v_user from public.users where password_reset_hash=p_token_hash and password_reset_expires_at>v_now and account_status='ACTIVE' for update;
  if not found then raise exception using errcode='P0001', message='INVALID_TOKEN: This password reset link is invalid or expired.'; end if;
  update public.users set password_hash=p_password_hash,password_salt=p_password_salt,password_reset_hash=null,password_reset_expires_at=null,session_version=session_version+1,updated_at=v_now where user_id=v_user.user_id;
  insert into public.audit_logs(audit_id,actor_id,action,entity_type,entity_id,details,created_at)
  values ('AUD-'||upper(replace(gen_random_uuid()::text,'-','')),v_user.user_id,'PASSWORD_RESET','USER',v_user.user_id,'{}'::jsonb,v_now);
  insert into public.security_logs(security_log_id,actor_id,event_type,subject,details,created_at)
  values ('SEC-'||upper(replace(gen_random_uuid()::text,'-','')),v_user.user_id,'PASSWORD_RESET_COMPLETED',v_user.email,'{}'::jsonb,v_now);
  return jsonb_build_object('user_id',v_user.user_id,'email',v_user.email);
end;
$$;
revoke all on function public.b2b_password_reset_complete(text,text,text) from public, anon, authenticated;
grant execute on function public.b2b_password_reset_complete(text,text,text) to service_role;
