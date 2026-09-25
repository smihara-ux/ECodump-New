CREATE SCHEMA direct;
CREATE TABLE direct.scopes(user_id uuid REFERENCES public.profiles(id),site_id uuid REFERENCES public.sites(id),role text NOT NULL CHECK(role IN ('construction','receiving')),PRIMARY KEY(user_id,site_id,role));
CREATE TABLE direct.receiving_locations(id uuid PRIMARY KEY REFERENCES public.sites(id),soil text NOT NULL,unit text NOT NULL CHECK(unit IN ('m3','t')),daily_capacity numeric(12,3) NOT NULL CHECK(daily_capacity>0));
CREATE TABLE direct.site_details(site_id uuid PRIMARY KEY REFERENCES public.sites(id),entrance text NOT NULL,contact_name text NOT NULL,phone text,notes text NOT NULL);
CREATE TABLE direct.partner_locations(construction_org_id uuid REFERENCES public.organizations(id),receiving_location_id uuid REFERENCES direct.receiving_locations(id),PRIMARY KEY(construction_org_id,receiving_location_id));
CREATE TABLE direct.bookings(id uuid PRIMARY KEY,construction_org_id uuid NOT NULL REFERENCES public.organizations(id),receiving_org_id uuid NOT NULL REFERENCES public.organizations(id),site_id uuid NOT NULL REFERENCES public.sites(id),receiving_location_id uuid NOT NULL REFERENCES direct.receiving_locations(id),created_by uuid NOT NULL REFERENCES public.profiles(id),business_date date NOT NULL,planned_at timestamptz NOT NULL,soil text NOT NULL,quantity numeric(12,3) NOT NULL CHECK(quantity>0),unit text NOT NULL CHECK(unit IN ('m3','t')),agreement_note text NOT NULL,agreement_state text NOT NULL DEFAULT 'pending' CHECK(agreement_state IN ('pending','agreed')),status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','confirmed')),version integer NOT NULL DEFAULT 1,confirmed_by uuid REFERENCES public.profiles(id),confirmed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE direct.trips(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid NOT NULL UNIQUE REFERENCES direct.bookings(id),vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),driver_id uuid NOT NULL REFERENCES public.drivers(id),rotation integer NOT NULL CHECK(rotation>0),planned_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','site_arrived','in_transit','receiver_arrived','unloaded')),version integer NOT NULL DEFAULT 1,assigned_by uuid NOT NULL REFERENCES public.profiles(id),completed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE direct.trip_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),trip_id uuid NOT NULL REFERENCES direct.trips(id),actor_id uuid NOT NULL REFERENCES public.profiles(id),state text NOT NULL,reported_at timestamptz NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),operation_key uuid NOT NULL,UNIQUE(trip_id,state));
CREATE TABLE direct.actuals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),trip_id uuid NOT NULL UNIQUE REFERENCES direct.trips(id),quantity numeric(12,3) NOT NULL CHECK(quantity>0),unit text NOT NULL CHECK(unit IN ('m3','t')),difference_reason text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'confirmed' CHECK(status='confirmed'),confirmed_by uuid NOT NULL REFERENCES public.profiles(id),confirmed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE direct.attachments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid NOT NULL REFERENCES direct.bookings(id),trip_id uuid REFERENCES direct.trips(id),uploaded_by uuid NOT NULL REFERENCES public.profiles(id),filename text NOT NULL CHECK(length(filename) BETWEEN 1 AND 120),mime text NOT NULL CHECK(mime IN ('image/png','image/jpeg','application/pdf')),data bytea NOT NULL CHECK(octet_length(data) BETWEEN 1 AND 2097152),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE direct.operations(actor_id uuid NOT NULL REFERENCES public.profiles(id),operation_key uuid NOT NULL,fingerprint text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,operation_key));
CREATE TABLE direct.audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id uuid NOT NULL REFERENCES public.profiles(id),action text NOT NULL,booking_id uuid NOT NULL REFERENCES direct.bookings(id),operation_key uuid NOT NULL,before_data jsonb,after_data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX direct_bookings_scope ON direct.bookings(site_id,receiving_location_id,business_date);
CREATE INDEX direct_events_trip ON direct.trip_events(trip_id);

CREATE FUNCTION direct.has_scope(s uuid,r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT EXISTS(SELECT 1 FROM direct.scopes sc JOIN public.sites s ON s.id=sc.site_id JOIN public.memberships m ON m.user_id=sc.user_id AND m.organization_id=s.organization_id WHERE sc.user_id=auth.uid() AND sc.site_id=$1 AND sc.role=$2 AND m.active AND ((r='construction' AND m.role::text IN ('prime_admin','site_manager','dispatcher','control_admin')) OR (r='receiving' AND m.role::text IN ('receiver','control_admin')))); $$;
CREATE FUNCTION direct.own_driver(d uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT EXISTS(SELECT 1 FROM public.drivers d JOIN public.memberships m ON m.user_id=d.profile_id AND m.organization_id=d.organization_id WHERE d.id=$1 AND d.profile_id=auth.uid() AND d.active AND m.active AND m.role::text='driver'); $$;
CREATE FUNCTION direct.can_booking(b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT EXISTS(SELECT 1 FROM direct.bookings b WHERE b.id=$1 AND (direct.has_scope(b.site_id,'construction') OR direct.has_scope(b.receiving_location_id,'receiving') OR EXISTS(SELECT 1 FROM direct.trips t WHERE t.booking_id=b.id AND direct.own_driver(t.driver_id)))); $$;
CREATE FUNCTION direct.can_org(o uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=auth.uid() AND m.organization_id=$1 AND m.active); $$;
CREATE FUNCTION direct.can_asset(o uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT EXISTS(SELECT 1 FROM public.sites s WHERE s.organization_id=$1 AND direct.has_scope(s.id,'construction')); $$;

-- Replace permissive organization-only baseline policies on shared tables for this slice.
DO $$ DECLARE p record; t text; BEGIN
FOREACH t IN ARRAY ARRAY['organizations','profiles','memberships','projects','sites','vehicles','drivers'] LOOP
EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t); END LOOP;
END LOOP;
END $$;
CREATE POLICY org_read ON public.organizations FOR SELECT USING(direct.can_org(id));
CREATE POLICY profile_read ON public.profiles FOR SELECT USING(id=auth.uid());
CREATE POLICY member_read ON public.memberships FOR SELECT USING(user_id=auth.uid());
CREATE POLICY project_read ON public.projects FOR SELECT USING(EXISTS(SELECT 1 FROM public.sites s WHERE s.project_id=projects.id AND (direct.has_scope(s.id,'construction') OR direct.has_scope(s.id,'receiving'))));
CREATE POLICY site_read ON public.sites FOR SELECT USING(direct.has_scope(id,'construction') OR direct.has_scope(id,'receiving'));
CREATE POLICY vehicle_read ON public.vehicles FOR SELECT USING(direct.can_asset(organization_id));
CREATE POLICY driver_read ON public.drivers FOR SELECT USING(direct.can_asset(organization_id) OR direct.own_driver(id));
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['scopes','receiving_locations','site_details','partner_locations','bookings','trips','trip_events','actuals','attachments','operations','audit'] LOOP EXECUTE format('ALTER TABLE direct.%I ENABLE ROW LEVEL SECURITY',t); END LOOP; END $$;
CREATE POLICY scopes_read ON direct.scopes FOR SELECT USING(user_id=auth.uid());
CREATE POLICY locations_read ON direct.receiving_locations FOR SELECT USING(direct.has_scope(id,'receiving'));
CREATE POLICY details_read ON direct.site_details FOR SELECT USING(direct.has_scope(site_id,'construction') OR direct.has_scope(site_id,'receiving'));
CREATE POLICY partner_read ON direct.partner_locations FOR SELECT USING(direct.can_asset(construction_org_id));
CREATE POLICY bookings_read ON direct.bookings FOR SELECT USING(direct.can_booking(id));
CREATE POLICY trips_read ON direct.trips FOR SELECT USING(direct.can_booking(booking_id));
CREATE POLICY events_read ON direct.trip_events FOR SELECT USING(EXISTS(SELECT 1 FROM direct.trips t WHERE t.id=trip_id AND direct.can_booking(t.booking_id)));
CREATE POLICY actuals_read ON direct.actuals FOR SELECT USING(EXISTS(SELECT 1 FROM direct.trips t WHERE t.id=trip_id AND direct.can_booking(t.booking_id)));
CREATE POLICY attachments_read ON direct.attachments FOR SELECT USING(direct.can_booking(booking_id));
CREATE POLICY operations_read ON direct.operations FOR SELECT USING(actor_id=auth.uid());
CREATE POLICY audit_read ON direct.audit FOR SELECT USING(direct.can_booking(booking_id));

-- All changes go through this checked transaction boundary; app roles have no table writes.
CREATE FUNCTION direct.mutate(action text, key uuid, payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); oldop direct.operations; b direct.bookings; tr direct.trips; loc direct.receiving_locations; s public.sites; dest public.sites; v public.vehicles; d public.drivers; result jsonb; bid uuid; fingerprint text:=md5(action||payload::text); expected integer; seq text[]:=ARRAY['assigned','site_arrived','in_transit','receiver_arrived','unloaded']; aid uuid; before_data jsonb;
BEGIN
IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=actor AND m.active) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||key::text,0));
SELECT * INTO oldop FROM direct.operations o WHERE o.actor_id=actor AND o.operation_key=key;
IF FOUND THEN IF oldop.fingerprint<>fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='40001'; END IF; RETURN oldop.result; END IF;
IF action='create' THEN
  SELECT * INTO s FROM public.sites WHERE id=(payload->>'siteId')::uuid;
  IF NOT FOUND OR NOT direct.has_scope(s.id,'construction') THEN RAISE EXCEPTION 'FORBIDDEN_SITE' USING ERRCODE='42501'; END IF;
  SELECT * INTO loc FROM direct.receiving_locations WHERE id=(payload->>'locationId')::uuid;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM direct.partner_locations p WHERE p.construction_org_id=s.organization_id AND p.receiving_location_id=loc.id) THEN RAISE EXCEPTION 'FORBIDDEN_PARTNER' USING ERRCODE='42501'; END IF;
  SELECT * INTO dest FROM public.sites WHERE id=loc.id;
  IF payload->>'unit'<>loc.unit OR payload->>'soil'<>loc.soil OR length(trim(coalesce(payload->>'agreementNote','')))<1 OR (payload->>'quantity')::numeric<=0 OR (payload->>'quantity')::numeric>loc.daily_capacity OR (payload->>'plannedAt') IS NULL THEN RAISE EXCEPTION 'INVALID_CONDITIONS' USING ERRCODE='22023'; END IF;
  bid:=(payload->>'id')::uuid;
  INSERT INTO direct.bookings(id,construction_org_id,receiving_org_id,site_id,receiving_location_id,created_by,business_date,planned_at,soil,quantity,unit,agreement_note) VALUES(bid,s.organization_id,dest.organization_id,s.id,loc.id,actor,((payload->>'plannedAt')::timestamptz AT TIME ZONE 'Asia/Tokyo')::date,(payload->>'plannedAt')::timestamptz,payload->>'soil',(payload->>'quantity')::numeric,payload->>'unit',payload->>'agreementNote');
  result:=jsonb_build_object('bookingId',bid,'version',1,'status','requested');
ELSE
  bid:=(payload->>'bookingId')::uuid;
  SELECT * INTO b FROM direct.bookings WHERE id=bid FOR UPDATE;
  IF NOT FOUND OR NOT direct.can_booking(bid) THEN RAISE EXCEPTION 'FORBIDDEN_BOOKING' USING ERRCODE='42501'; END IF;
  before_data:=to_jsonb(b);
  IF action IN ('confirm','assign') THEN
    IF NOT payload ? 'expectedVersion' OR (payload->>'expectedVersion')::integer<>b.version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='40001'; END IF;
  END IF;
  IF action='confirm' THEN
    IF NOT direct.has_scope(b.receiving_location_id,'receiving') THEN RAISE EXCEPTION 'FORBIDDEN_CONFIRM' USING ERRCODE='42501'; END IF;
    IF b.status<>'requested' THEN RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE='22023'; END IF;
    IF payload->>'agree'<>'true' THEN RAISE EXCEPTION 'AGREEMENT_REQUIRED' USING ERRCODE='22023'; END IF;
    SELECT * INTO loc FROM direct.receiving_locations WHERE id=b.receiving_location_id FOR UPDATE;
    IF b.quantity+coalesce((SELECT sum(quantity) FROM direct.bookings WHERE receiving_location_id=loc.id AND business_date=b.business_date AND status='confirmed'),0)>loc.daily_capacity THEN RAISE EXCEPTION 'CAPACITY_EXCEEDED' USING ERRCODE='40001'; END IF;
    UPDATE direct.bookings SET status='confirmed',agreement_state='agreed',confirmed_by=actor,confirmed_at=clock_timestamp(),version=version+1 WHERE id=bid;
    result:=jsonb_build_object('bookingId',bid,'version',b.version+1,'status','confirmed');
  ELSIF action='assign' THEN
    IF NOT direct.has_scope(b.site_id,'construction') THEN RAISE EXCEPTION 'FORBIDDEN_ASSIGN' USING ERRCODE='42501'; END IF;
    IF b.status<>'confirmed' OR b.agreement_state<>'agreed' THEN RAISE EXCEPTION 'RESERVATION_NOT_CONFIRMED' USING ERRCODE='22023'; END IF;
    SELECT * INTO v FROM public.vehicles WHERE id=(payload->>'vehicleId')::uuid FOR UPDATE;
    SELECT * INTO d FROM public.drivers WHERE id=(payload->>'driverId')::uuid FOR UPDATE;
    IF v.id IS NULL OR d.id IS NULL OR v.organization_id<>b.construction_org_id OR d.organization_id<>b.construction_org_id OR NOT v.active OR NOT d.active OR NOT EXISTS(SELECT 1 FROM public.memberships WHERE organization_id=d.organization_id AND user_id=d.profile_id AND active AND role::text='driver') THEN RAISE EXCEPTION 'FORBIDDEN_ASSIGNMENT' USING ERRCODE='42501'; END IF;
    IF EXISTS(SELECT 1 FROM direct.trips t WHERE (t.vehicle_id=v.id OR t.driver_id=d.id) AND t.planned_at BETWEEN b.planned_at-interval '59 minutes' AND b.planned_at+interval '59 minutes') THEN RAISE EXCEPTION 'ASSIGNMENT_OVERLAP' USING ERRCODE='40001'; END IF;
    INSERT INTO direct.trips(booking_id,vehicle_id,driver_id,rotation,planned_at,assigned_by) VALUES(bid,v.id,d.id,(SELECT count(*)+1 FROM direct.trips t WHERE t.vehicle_id=v.id AND (t.planned_at AT TIME ZONE 'Asia/Tokyo')::date=b.business_date),b.planned_at,actor) RETURNING * INTO tr;
    UPDATE direct.bookings SET version=version+1 WHERE id=bid;
    result:=jsonb_build_object('bookingId',bid,'tripId',tr.id,'version',b.version+1,'tripVersion',1,'status','assigned');
  ELSIF action IN ('report','actual') THEN
    SELECT * INTO tr FROM direct.trips WHERE booking_id=bid FOR UPDATE;
    IF tr.id IS NULL OR NOT payload ? 'expectedVersion' OR tr.version<>(payload->>'expectedVersion')::integer THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='40001'; END IF;
    before_data:=to_jsonb(tr);
    IF action='report' THEN
      IF NOT direct.own_driver(tr.driver_id) THEN RAISE EXCEPTION 'FORBIDDEN_DRIVER' USING ERRCODE='42501'; END IF;
      IF array_position(seq,payload->>'state') IS DISTINCT FROM array_position(seq,tr.status)+1 THEN RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE='22023'; END IF;
      IF (payload->>'reportedAt')::timestamptz > now()+interval '5 minutes' OR (payload->>'reportedAt')::timestamptz < tr.created_at-interval '5 minutes' THEN RAISE EXCEPTION 'INVALID_TIME' USING ERRCODE='22023'; END IF;
      INSERT INTO direct.trip_events(trip_id,actor_id,state,reported_at,operation_key) VALUES(tr.id,actor,payload->>'state',(payload->>'reportedAt')::timestamptz,key);
      UPDATE direct.trips SET status=payload->>'state',version=version+1,completed_at=CASE WHEN payload->>'state'='unloaded' THEN clock_timestamp() ELSE NULL END WHERE id=tr.id;
      result:=jsonb_build_object('bookingId',bid,'tripId',tr.id,'tripVersion',tr.version+1,'status',payload->>'state');
    ELSE
      IF NOT direct.has_scope(b.receiving_location_id,'receiving') THEN RAISE EXCEPTION 'FORBIDDEN_ACTUAL' USING ERRCODE='42501'; END IF;
      IF tr.status<>'unloaded' THEN RAISE EXCEPTION 'UNLOAD_REQUIRED' USING ERRCODE='22023'; END IF;
      IF payload->>'unit'<>b.unit OR (payload->>'quantity')::numeric<=0 OR ((payload->>'quantity')::numeric<>b.quantity AND length(trim(coalesce(payload->>'differenceReason','')))=0) THEN RAISE EXCEPTION 'INVALID_ACTUAL' USING ERRCODE='22023'; END IF;
      INSERT INTO direct.actuals(trip_id,quantity,unit,difference_reason,confirmed_by) VALUES(tr.id,(payload->>'quantity')::numeric,payload->>'unit',coalesce(payload->>'differenceReason',''),actor);
      UPDATE direct.trips SET version=version+1 WHERE id=tr.id;
      result:=jsonb_build_object('bookingId',bid,'tripId',tr.id,'tripVersion',tr.version+1,'status','actual_confirmed');
    END IF;
  ELSIF action='attachment' THEN
    IF EXISTS(SELECT 1 FROM direct.trips t JOIN direct.actuals a ON a.trip_id=t.id WHERE t.booking_id=bid) THEN RAISE EXCEPTION 'ACTUAL_LOCKED' USING ERRCODE='22023'; END IF;
    INSERT INTO direct.attachments(booking_id,trip_id,uploaded_by,filename,mime,data) VALUES(bid,(SELECT id FROM direct.trips WHERE booking_id=bid),actor,payload->>'filename',payload->>'mime',decode(payload->>'base64','base64')) RETURNING id INTO aid;
    result:=jsonb_build_object('bookingId',bid,'attachmentId',aid,'status','stored');
  ELSE RAISE EXCEPTION 'UNKNOWN_ACTION' USING ERRCODE='22023'; END IF;
END IF;
INSERT INTO direct.operations VALUES(actor,key,fingerprint,result,now());
INSERT INTO direct.audit(actor_id,action,booking_id,operation_key,before_data,after_data) VALUES(actor,action,bid,key,before_data,result);
RETURN result;
END $$;

-- Minimal shared transaction projection, no internal organization/user catalog exposed.
CREATE FUNCTION direct.list_bookings() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT coalesce(jsonb_agg(jsonb_build_object(
'id',b.id,'version',b.version,'date',b.business_date,'plannedAt',b.planned_at,'soil',b.soil,'quantity',b.quantity,'unit',b.unit,'agreementNote',CASE WHEN direct.own_driver(t.driver_id) THEN NULL ELSE b.agreement_note END,'agreementState',b.agreement_state,'status',b.status,
'site',jsonb_build_object('id',s.id,'name',s.name,'address',s.address,'entrance',sd.entrance,'contact',sd.contact_name,'phone',sd.phone,'notes',sd.notes),
'location',jsonb_build_object('id',r.id,'name',r.name,'address',r.address,'entrance',rd.entrance,'contact',rd.contact_name,'phone',rd.phone,'notes',rd.notes),
'canConfirm',direct.has_scope(b.receiving_location_id,'receiving'),'canAssign',direct.has_scope(b.site_id,'construction'),'canReport',direct.own_driver(t.driver_id),
'trip',CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object('id',t.id,'version',t.version,'status',t.status,'rotation',t.rotation,'vehicle',v.display_name,'vehicleId',v.id,'driver',d.display_name,'driverId',d.id,'completedAt',t.completed_at) END,
'events',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'state',e.state,'reportedAt',e.reported_at,'receivedAt',e.received_at) ORDER BY e.received_at) FROM direct.trip_events e WHERE e.trip_id=t.id),'[]'::jsonb),
'actual',(SELECT jsonb_build_object('id',a.id,'quantity',a.quantity,'unit',a.unit,'status',a.status,'confirmedAt',a.confirmed_at,'differenceReason',a.difference_reason) FROM direct.actuals a WHERE a.trip_id=t.id),
'attachments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'filename',a.filename,'mime',a.mime,'bytes',octet_length(a.data))) FROM direct.attachments a WHERE a.booking_id=b.id),'[]'::jsonb)
) ORDER BY b.planned_at,b.id),'[]'::jsonb)
FROM direct.bookings b JOIN public.sites s ON s.id=b.site_id JOIN public.sites r ON r.id=b.receiving_location_id LEFT JOIN direct.site_details sd ON sd.site_id=s.id LEFT JOIN direct.site_details rd ON rd.site_id=r.id LEFT JOIN direct.trips t ON t.booking_id=b.id LEFT JOIN public.vehicles v ON v.id=t.vehicle_id LEFT JOIN public.drivers d ON d.id=t.driver_id WHERE direct.can_booking(b.id); $$;
CREATE FUNCTION direct.partner_catalog() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',s.name,'soil',r.soil,'unit',r.unit,'capacity',r.daily_capacity)),'[]'::jsonb) FROM direct.receiving_locations r JOIN public.sites s ON s.id=r.id WHERE EXISTS(SELECT 1 FROM direct.partner_locations p WHERE p.receiving_location_id=r.id AND direct.can_asset(p.construction_org_id)); $$;

-- Existing authenticated direct-write grants are explicitly revoked on reused core tables.
REVOKE ALL ON public.organizations,public.profiles,public.memberships,public.projects,public.sites,public.vehicles,public.drivers FROM authenticated,anon;
REVOKE ALL ON ALL TABLES IN SCHEMA direct FROM PUBLIC,authenticated,anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA direct FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA direct,public TO authenticated;
GRANT SELECT ON public.organizations,public.profiles,public.memberships,public.projects,public.sites,public.vehicles,public.drivers TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA direct TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA direct TO authenticated;
