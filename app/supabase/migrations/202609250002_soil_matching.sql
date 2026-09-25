-- Shared soil matching. Writes remain API/RPC-only; browser clients receive select policies.
create type public.match_case_side as enum ('construction','receiving');
create type public.match_case_status as enum ('draft','published','closed');
create type public.consultation_status as enum ('consulting','agreed','cancelled');
create table public.match_cases (
 id uuid primary key default gen_random_uuid(), owner_organization_id uuid not null references public.organizations(id), owner_side public.match_case_side not null,
 status public.match_case_status not null default 'draft', title text not null, region text not null, soil_type text not null,
 quantity numeric(12,2) not null check(quantity>0), unit text not null, period_start date not null, period_end date not null check(period_end>=period_start),
 public_data jsonb not null default '{}', shared_data jsonb not null default '{}', internal_data jsonb not null default '{}', documents jsonb not null default '[]',
 version bigint not null default 1, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.match_consultations (
 id uuid primary key default gen_random_uuid(), source_case_id uuid not null references public.match_cases(id), target_case_id uuid not null references public.match_cases(id),
 source_organization_id uuid not null references public.organizations(id), target_organization_id uuid not null references public.organizations(id),
 status public.consultation_status not null default 'consulting', version bigint not null default 1, created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(source_organization_id<>target_organization_id)
);
create table public.match_offers (id uuid primary key default gen_random_uuid(), consultation_id uuid not null references public.match_consultations(id), offer_no integer not null check(offer_no>0), offered_by_organization_id uuid not null references public.organizations(id), terms_snapshot jsonb not null, message text not null, created_at timestamptz not null default now(), unique(consultation_id,offer_no));
create table public.match_acceptances (consultation_id uuid not null references public.match_consultations(id), offer_no integer not null, organization_id uuid not null references public.organizations(id), accepted_by uuid not null references public.profiles(id), accepted_at timestamptz not null default now(), primary key(consultation_id,offer_no,organization_id));
create table public.match_agreements (id uuid primary key default gen_random_uuid(), consultation_id uuid not null unique references public.match_consultations(id), offer_no integer not null, source_case_snapshot jsonb not null, target_case_snapshot jsonb not null, terms_snapshot jsonb not null, agreed_at timestamptz not null default now(), version bigint not null default 1);
create table public.match_agreement_reservations (agreement_id uuid primary key references public.match_agreements(id), reservation_id uuid not null unique references public.reservations(id));
alter table public.match_cases enable row level security; alter table public.match_consultations enable row level security; alter table public.match_offers enable row level security; alter table public.match_acceptances enable row level security; alter table public.match_agreements enable row level security; alter table public.match_agreement_reservations enable row level security;
revoke all on public.match_cases,public.match_consultations,public.match_offers,public.match_acceptances,public.match_agreements,public.match_agreement_reservations from anon,authenticated;
-- No direct authenticated grants: direct SELECT would expose shared_data/internal_data.
-- The Edge API or projection RPC must return the role-specific projection.
create policy match_case_visible on public.match_cases for select to authenticated using (status='published' or private.has_org_access(owner_organization_id));
create policy match_consultation_party on public.match_consultations for select to authenticated using (private.has_org_access(source_organization_id) or private.has_org_access(target_organization_id));
create policy match_offer_party on public.match_offers for select to authenticated using (exists(select 1 from public.match_consultations c where c.id=consultation_id and (private.has_org_access(c.source_organization_id) or private.has_org_access(c.target_organization_id))));
create policy match_acceptance_party on public.match_acceptances for select to authenticated using (exists(select 1 from public.match_consultations c where c.id=consultation_id and (private.has_org_access(c.source_organization_id) or private.has_org_access(c.target_organization_id))));
create policy match_agreement_party on public.match_agreements for select to authenticated using (exists(select 1 from public.match_consultations c where c.id=consultation_id and (private.has_org_access(c.source_organization_id) or private.has_org_access(c.target_organization_id))));
create policy match_agreement_reservation_party on public.match_agreement_reservations for select to authenticated using (exists(select 1 from public.match_agreements a join public.match_consultations c on c.id=a.consultation_id where a.id=agreement_id and (private.has_org_access(c.source_organization_id) or private.has_org_access(c.target_organization_id))));
-- Policies are defense in depth for a future narrow column projection. With the current
-- revoke they do not make raw rows readable by browser clients.
