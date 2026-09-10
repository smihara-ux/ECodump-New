-- ECO DUMP initial production-ready schema.
-- Apply through Supabase SQL Editor or generate a migration after a project is linked.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;
create schema if not exists private;

create type public.membership_role as enum ('control_admin', 'prime_admin', 'site_manager', 'dispatcher', 'driver', 'receiver', 'viewer');
create type public.transport_status as enum ('planned', 'dispatched', 'loading', 'in_transit', 'receiving', 'completed', 'cancelled');
create type public.route_approval_status as enum ('candidate', 'review_required', 'approved', 'rejected', 'expired');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  customer_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('draft', 'active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  external_code text not null,
  name text not null,
  address text not null,
  location extensions.geography(point, 4326),
  start_on date,
  end_on date,
  status text not null default 'active' check (status in ('draft', 'active', 'completed', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, external_code)
);
create index sites_location_gix on public.sites using gist (location);
create index sites_organization_idx on public.sites (organization_id, project_id, status);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  registration_number text not null,
  display_name text not null,
  vehicle_class text not null,
  width_m numeric(4,2),
  height_m numeric(4,2),
  length_m numeric(5,2),
  gross_weight_t numeric(6,2),
  axle_weight_t numeric(5,2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, registration_number)
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  license_expires_on date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.route_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  departure_site_id uuid not null references public.sites(id),
  destination_site_id uuid not null references public.sites(id),
  vehicle_id uuid references public.vehicles(id),
  geometry extensions.geography(linestring, 4326),
  distance_m integer check (distance_m >= 0),
  duration_seconds integer check (duration_seconds >= 0),
  approval_status public.route_approval_status not null default 'candidate',
  restriction_snapshot jsonb not null default '{}'::jsonb,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index route_plans_geometry_gix on public.route_plans using gist (geometry);
create index route_plans_organization_idx on public.route_plans (organization_id, approval_status);

create table public.transport_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_code text not null,
  departure_site_id uuid not null references public.sites(id),
  destination_site_id uuid not null references public.sites(id),
  vehicle_id uuid references public.vehicles(id),
  driver_id uuid references public.drivers(id),
  route_plan_id uuid references public.route_plans(id),
  status public.transport_status not null default 'planned',
  cargo_type text not null,
  planned_volume_m3 numeric(8,2) check (planned_volume_m3 >= 0),
  actual_volume_m3 numeric(8,2) check (actual_volume_m3 >= 0),
  planned_departure_at timestamptz not null,
  estimated_arrival_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, order_code)
);
create index transport_orders_timeline_idx on public.transport_orders (organization_id, planned_departure_at, status);

create table public.vehicle_positions (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  transport_order_id uuid references public.transport_orders(id) on delete set null,
  position extensions.geography(point, 4326) not null,
  speed_kph numeric(5,1) check (speed_kph >= 0),
  heading_deg numeric(5,1) check (heading_deg >= 0 and heading_deg < 360),
  recorded_at timestamptz not null default now()
);
create index vehicle_positions_vehicle_time_idx on public.vehicle_positions (vehicle_id, recorded_at desc);
create index vehicle_positions_position_gix on public.vehicle_positions using gist (position);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_org_time_idx on public.audit_logs (organization_id, created_at desc);

create or replace function private.has_org_access(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = target_organization_id
      and m.user_id = (select auth.uid())
      and m.active
  );
$$;
revoke all on function private.has_org_access(uuid) from public, anon;
grant execute on function private.has_org_access(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.projects enable row level security;
alter table public.sites enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.route_plans enable row level security;
alter table public.transport_orders enable row level security;
alter table public.vehicle_positions enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.organizations, public.memberships to authenticated;
grant select, insert, update, delete on public.projects, public.sites, public.vehicles, public.drivers, public.route_plans, public.transport_orders to authenticated;
grant select, insert on public.vehicle_positions to authenticated;
grant select on public.audit_logs to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy organizations_member_select on public.organizations for select to authenticated using (private.has_org_access(id));
create policy profiles_self_select on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_self_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_self_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy memberships_member_select on public.memberships for select to authenticated using (private.has_org_access(organization_id));

create policy projects_member_all on public.projects for all to authenticated using (private.has_org_access(organization_id)) with check (private.has_org_access(organization_id));
create policy sites_member_all on public.sites for all to authenticated using (private.has_org_access(organization_id)) with check (private.has_org_access(organization_id));
create policy vehicles_member_all on public.vehicles for all to authenticated using (private.has_org_access(organization_id)) with check (private.has_org_access(organization_id));
create policy drivers_member_all on public.drivers for all to authenticated using (private.has_org_access(organization_id)) with check (private.has_org_access(organization_id));
create policy route_plans_member_all on public.route_plans for all to authenticated using (private.has_org_access(organization_id)) with check (private.has_org_access(organization_id));
create policy transport_orders_member_all on public.transport_orders for all to authenticated using (private.has_org_access(organization_id)) with check (private.has_org_access(organization_id));
create policy vehicle_positions_member_select on public.vehicle_positions for select to authenticated using (private.has_org_access(organization_id));
create policy vehicle_positions_member_insert on public.vehicle_positions for insert to authenticated with check (private.has_org_access(organization_id));
create policy audit_logs_member_select on public.audit_logs for select to authenticated using (private.has_org_access(organization_id));

alter publication supabase_realtime add table public.transport_orders;
alter publication supabase_realtime add table public.vehicle_positions;
