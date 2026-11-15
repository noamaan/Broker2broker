-- Broker2Broker Supabase schema. All access goes through the server using a secret key.
-- No direct anon/authenticated table access is granted; RLS is enabled on every app table.

create extension if not exists pgcrypto;

create table public.users (
  user_id text primary key,
  full_name text not null default '',
  mobile text not null default '',
  email text not null,
  password_hash text not null,
  password_salt text not null,
  agency_name text not null default '',
  whatsapp_number text not null default '',
  city text not null default '',
  preferred_localities jsonb not null default '[]'::jsonb,
  role text not null default 'USER' check (role in ('USER','ADMIN','DEVELOPER')),
  account_status text not null default 'ACTIVE' check (account_status in ('ACTIVE','SUSPENDED')),
  membership_status text not null default 'FREE ACCOUNT',
  current_plan text not null default 'FREE',
  membership_start_at timestamptz,
  membership_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz,
  password_reset_hash text,
  password_reset_expires_at timestamptz
);
create unique index users_email_lower_uq on public.users (lower(email));

create table public.broker_profiles (
  profile_id text primary key,
  user_id text not null unique references public.users(user_id) on delete cascade,
  bio text not null default '',
  languages jsonb not null default '[]'::jsonb,
  specialties jsonb not null default '[]'::jsonb,
  is_verified boolean not null default false,
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listings (
  listing_id text primary key,
  owner_id text not null references public.users(user_id) on delete cascade,
  title text not null,
  transaction_type text not null,
  property_type text not null,
  bhk text not null default '',
  city text not null,
  locality text not null,
  landmark text not null default '',
  carpet_area text not null default '',
  built_up_area text not null default '',
  furnishing text not null default 'NOT_SPECIFIED',
  floor text not null default '',
  amenities jsonb not null default '[]'::jsonb,
  price numeric(15,2) not null default 0,
  rent numeric(15,2) not null default 0,
  deposit numeric(15,2) not null default 0,
  availability text not null default '',
  tenant_preference text not null default '',
  contact_numbers jsonb not null default '[]'::jsonb,
  description text not null default '',
  original_text text not null default '',
  images jsonb not null default '[]'::jsonb,
  status text not null default 'DRAFT',
  availability_confirmed_at timestamptz,
  reconfirm_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index listings_owner_created_idx on public.listings (owner_id, created_at desc);
create index listings_public_search_idx on public.listings (status, city, locality, transaction_type, property_type);
create index listings_reconfirm_due_idx on public.listings (reconfirm_due_at) where status = 'ACTIVE';

create table public.payment_requests (
  request_id text primary key,
  user_id text not null references public.users(user_id),
  full_name text not null default '',
  mobile text not null default '',
  email text not null default '',
  agency_name text not null default '',
  subscription_plan text not null,
  amount numeric(15,2) not null,
  upi_transaction_id text not null,
  payment_date date not null,
  request_date timestamptz not null default now(),
  status text not null default 'PENDING VERIFICATION',
  admin_notes text not null default '',
  approved_by text,
  approval_date timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  screenshot_file_id text,
  duration_days integer not null,
  whatsapp_number text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index payment_requests_utr_uq on public.payment_requests (upper(regexp_replace(upi_transaction_id, '\s+', '', 'g')));
create index payment_requests_user_date_idx on public.payment_requests (user_id, request_date desc);
create index payment_requests_status_date_idx on public.payment_requests (status, request_date desc);

create table public.payments (
  payment_id text primary key,
  request_id text not null unique references public.payment_requests(request_id),
  user_id text not null references public.users(user_id),
  plan text not null,
  amount numeric(15,2) not null,
  upi_transaction_id text not null,
  payment_date date not null,
  status text not null,
  verified_by text not null,
  verified_at timestamptz not null,
  created_at timestamptz not null default now()
);
create unique index payments_utr_uq on public.payments (upper(regexp_replace(upi_transaction_id, '\s+', '', 'g')));

create table public.subscriptions (
  subscription_id text primary key,
  user_id text not null references public.users(user_id),
  payment_request_id text not null references public.payment_requests(request_id),
  payment_id text not null references public.payments(payment_id),
  plan text not null,
  amount numeric(15,2) not null,
  duration_days integer not null,
  status text not null,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  approved_by text not null,
  renewal_type text not null,
  created_at timestamptz not null default now()
);
create index subscriptions_user_date_idx on public.subscriptions (user_id, created_at desc);

create table public.categories (
  category_id text primary key,
  name text not null,
  parent_id text not null default '',
  kind text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.localities (
  locality_id text primary key,
  city text not null,
  name text not null,
  state text not null default 'Maharashtra',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city, name)
);

create table public.favourites (
  favourite_id text primary key,
  user_id text not null references public.users(user_id) on delete cascade,
  listing_id text not null references public.listings(listing_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

create table public.reports (
  report_id text primary key,
  listing_id text not null references public.listings(listing_id),
  reporter_id text not null references public.users(user_id),
  reason text not null,
  details text not null default '',
  status text not null default 'PENDING',
  admin_notes text not null default '',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_status_date_idx on public.reports (status, created_at desc);

create table public.notifications (
  notification_id text primary key,
  user_id text not null references public.users(user_id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  related_id text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_date_idx on public.notifications (user_id, created_at desc);

create table public.admins (
  admin_id text primary key,
  user_id text not null unique references public.users(user_id) on delete cascade,
  email text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.developers (
  developer_id text primary key,
  user_id text not null unique references public.users(user_id) on delete cascade,
  email text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

create table public.settings (
  setting_id text primary key,
  key text not null unique,
  value text not null default '',
  value_type text not null default 'string',
  is_public boolean not null default false,
  updated_by text not null default 'SYSTEM',
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  audit_id text primary key,
  actor_id text not null default 'SYSTEM',
  action text not null,
  entity_type text not null,
  entity_id text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_date_idx on public.audit_logs (created_at desc);

create table public.security_logs (
  security_log_id text primary key,
  actor_id text not null default '',
  event_type text not null,
  subject text not null default '',
  ip_hash text not null default '',
  user_agent text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index security_logs_date_idx on public.security_logs (created_at desc);

create table public.file_assets (
  file_id text primary key,
  owner_id text not null references public.users(user_id),
  purpose text not null check (purpose in ('PAYMENT_PROOF','LISTING_IMAGE','QR_CODE')),
  related_id text not null default '',
  bucket text not null default 'b2b-private-assets',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 2600000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index file_assets_owner_purpose_idx on public.file_assets (owner_id, purpose, active);

-- Private operational state: one-time bootstrap, replay protection, and rate limiting.
create table public.platform_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
insert into public.platform_config(key,value) values
  ('developer_bootstrap_state','unused'),
  ('developer_user_id','')
on conflict (key) do nothing;

create table public.request_nonces (
  nonce text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);
create index request_nonces_expiry_idx on public.request_nonces (expires_at);

create table public.rate_limit_events (
  event_id bigint generated always as identity primary key,
  action text not null,
  subject_hash text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_window_idx on public.rate_limit_events (action, subject_hash, created_at desc);

-- All application tables are private. The Next.js server uses a secret key; browser clients get no table access.
alter table public.users enable row level security;
alter table public.broker_profiles enable row level security;
alter table public.listings enable row level security;
alter table public.payment_requests enable row level security;
alter table public.payments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.categories enable row level security;
alter table public.localities enable row level security;
alter table public.favourites enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.admins enable row level security;
alter table public.developers enable row level security;
alter table public.settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.security_logs enable row level security;
alter table public.file_assets enable row level security;
alter table public.platform_config enable row level security;
alter table public.request_nonces enable row level security;
alter table public.rate_limit_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;

-- Private Supabase Storage bucket for listing photos, payment evidence, and the payment QR.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('b2b-private-assets','b2b-private-assets',false,2600000,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=2600000, allowed_mime_types=array['image/jpeg','image/png','image/webp'];

-- Initial public payment/support defaults and private platform settings.
insert into public.settings(setting_id,key,value,value_type,is_public,updated_by) values
  ('SET-PAY-UPI','payment.upiId','','string',true,'SYSTEM'),
  ('SET-PAY-NAME','payment.payeeName','','string',true,'SYSTEM'),
  ('SET-PAY-QR','payment.upiQrFileId','','string',false,'SYSTEM'),
  ('SET-PAY-WA','payment.whatsappNumber','','string',true,'SYSTEM'),
  ('SET-PAY-MONTH','payment.monthlyPrice','199','number',true,'SYSTEM'),
  ('SET-PAY-YEAR','payment.yearlyPrice','1999','number',true,'SYSTEM'),
  ('SET-PAY-MONTH-DAYS','payment.monthlyDurationDays','30','number',true,'SYSTEM'),
  ('SET-PAY-YEAR-DAYS','payment.yearlyDurationDays','365','number',true,'SYSTEM'),
  ('SET-PAY-INSTRUCTIONS','payment.instructions','Scan the QR code or pay directly to the UPI ID shown above. After completing payment, submit your UTR and payment date for manual verification.','string',true,'SYSTEM'),
  ('SET-PAY-SUPPORT','payment.customerSupportMessage','For payment questions, contact the support number shown here. Membership is activated only after an administrator verifies the UPI credit.','string',true,'SYSTEM'),
  ('SET-SUPPORT-EMAIL','support.email','','string',true,'SYSTEM'),
  ('SET-SUPPORT-HOURS','support.hours','','string',true,'SYSTEM'),
  ('SET-MAINTENANCE','platform.maintenanceMode','false','boolean',false,'SYSTEM'),
  ('SET-AI-PROVIDER','ai.provider','rule-based','string',false,'SYSTEM'),
  ('SET-AI-MODEL','ai.model','','string',false,'SYSTEM')
on conflict (key) do nothing;

insert into public.categories(category_id,name,parent_id,kind,active,sort_order) values
  ('RES-1RK','1RK','RESIDENTIAL','PROPERTY',true,10),
  ('RES-1BHK','1BHK','RESIDENTIAL','PROPERTY',true,20),
  ('RES-2BHK','2BHK','RESIDENTIAL','PROPERTY',true,30),
  ('RES-3BHK','3BHK','RESIDENTIAL','PROPERTY',true,40),
  ('RES-4BHK','4BHK','RESIDENTIAL','PROPERTY',true,50),
  ('RES-5BHK','5BHK+','RESIDENTIAL','PROPERTY',true,60),
  ('RES-STUDIO','Studio','RESIDENTIAL','PROPERTY',true,70),
  ('RES-DUPLEX','Duplex','RESIDENTIAL','PROPERTY',true,80),
  ('RES-PENTHOUSE','Penthouse','RESIDENTIAL','PROPERTY',true,90),
  ('RES-BUNGALOW','Bungalow','RESIDENTIAL','PROPERTY',true,100),
  ('RES-VILLA','Villa','RESIDENTIAL','PROPERTY',true,110),
  ('RES-ROWHOUSE','Row House','RESIDENTIAL','PROPERTY',true,120),
  ('COM-SHOP','Shop','COMMERCIAL','PROPERTY',true,200),
  ('COM-OFFICE','Office','COMMERCIAL','PROPERTY',true,210),
  ('COM-SHOWROOM','Showroom','COMMERCIAL','PROPERTY',true,220),
  ('COM-WAREHOUSE','Warehouse','COMMERCIAL','PROPERTY',true,230),
  ('COM-GODOWN','Godown','COMMERCIAL','PROPERTY',true,240),
  ('COM-INDUSTRIAL','Industrial Unit','COMMERCIAL','PROPERTY',true,250),
  ('COM-BUILDING','Commercial Building','COMMERCIAL','PROPERTY',true,260),
  ('OTH-PLOT','Plot','OTHER','PROPERTY',true,300),
  ('OTH-LAND','Land','OTHER','PROPERTY',true,310),
  ('OTH-PG','PG','OTHER','PROPERTY',true,320),
  ('OTH-HOSTEL','Hostel','OTHER','PROPERTY',true,330),
  ('OTH-COLIVING','Co-living','OTHER','PROPERTY',true,340),
  ('TX-RENT','Rent','','TRANSACTION',true,10),
  ('TX-SALE','Sale','','TRANSACTION',true,20),
  ('TX-RESALE','Resale','','TRANSACTION',true,30),
  ('TX-HEAVY-DEPOSIT','Heavy Deposit','','TRANSACTION',true,40),
  ('TX-LEASE','Lease','','TRANSACTION',true,50),
  ('TX-COMM-RENT','Commercial Rent','','TRANSACTION',true,60),
  ('TX-COMM-SALE','Commercial Sale','','TRANSACTION',true,70)
on conflict (category_id) do nothing;

insert into public.localities(locality_id,city,name,state,active) values
  ('LOC-MIRA-ROAD','Mira Bhayandar','Mira Road','Maharashtra',true),
  ('LOC-BHAYANDAR','Mira Bhayandar','Bhayandar','Maharashtra',true),
  ('LOC-NAYA-NAGAR','Mira Bhayandar','Naya Nagar','Maharashtra',true),
  ('LOC-SHIVAR-GARDEN','Mira Bhayandar','Shivar Garden','Maharashtra',true),
  ('LOC-KANAKIA','Mira Bhayandar','Kanakia','Maharashtra',true),
  ('LOC-DAHISAR','Mumbai','Dahisar','Maharashtra',true),
  ('LOC-BORIVALI','Mumbai','Borivali','Maharashtra',true),
  ('LOC-KANDIVALI','Mumbai','Kandivali','Maharashtra',true),
  ('LOC-MALAD','Mumbai','Malad','Maharashtra',true),
  ('LOC-GOREGAON','Mumbai','Goregaon','Maharashtra',true),
  ('LOC-ANDHERI','Mumbai','Andheri','Maharashtra',true),
  ('LOC-VASAI','Vasai-Virar','Vasai','Maharashtra',true),
  ('LOC-VIRAR','Vasai-Virar','Virar','Maharashtra',true),
  ('LOC-NAIGAON','Vasai-Virar','Naigaon','Maharashtra',true)
on conflict (city,name) do nothing;
