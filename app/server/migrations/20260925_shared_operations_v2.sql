-- Additive shared model: bookings own many independently addressed trips.
ALTER TABLE direct.trips DROP CONSTRAINT trips_booking_id_key;
ALTER TABLE direct.trips ADD COLUMN planned_quantity numeric(12,3), ADD COLUMN unit text CHECK(unit IN ('m3','t'));
UPDATE direct.trips t SET planned_quantity=b.quantity,unit=b.unit FROM direct.bookings b WHERE b.id=t.booking_id;
ALTER TABLE direct.trips ALTER COLUMN planned_quantity SET NOT NULL, ALTER COLUMN unit SET NOT NULL;
ALTER TABLE direct.trips ADD CHECK(planned_quantity>0);
ALTER TABLE direct.trips DROP CONSTRAINT trips_status_check;
ALTER TABLE direct.trips ADD CHECK(status IN ('assigned','site_arrived','in_transit','receiver_arrived','unloaded','cancelled','refused'));
ALTER TABLE direct.bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE direct.bookings ADD CHECK(status IN ('requested','confirmed','change_requested','cancelled','rejected'));
ALTER TABLE direct.gate_records ADD COLUMN trip_id uuid REFERENCES direct.trips(id);
UPDATE direct.gate_records g SET trip_id=t.id FROM direct.trips t WHERE t.booking_id=g.booking_id;
-- Existing validation data can contain historical duplicate gate reviews. Keep it
-- intact; receive_mutate remains the checked write boundary for new records.
CREATE INDEX gate_trip_direction_lookup ON direct.gate_records(trip_id,direction) WHERE status='confirmed';
CREATE TABLE direct.carrier_permissions(construction_org_id uuid REFERENCES public.organizations(id),carrier_org_id uuid REFERENCES public.organizations(id),vehicle_id uuid REFERENCES public.vehicles(id),driver_id uuid REFERENCES public.drivers(id),active boolean NOT NULL DEFAULT true,PRIMARY KEY(construction_org_id,vehicle_id,driver_id));
ALTER TABLE direct.carrier_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY carrier_read ON direct.carrier_permissions FOR SELECT USING(direct.can_asset(construction_org_id));
GRANT SELECT ON direct.carrier_permissions TO authenticated;
CREATE FUNCTION direct.can_dispatch(c uuid,v uuid,d uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT EXISTS(SELECT 1 FROM public.vehicles v JOIN public.drivers d ON d.id=$3 WHERE v.id=$2 AND v.active AND d.active AND (v.organization_id=$1 AND d.organization_id=$1 OR EXISTS(SELECT 1 FROM direct.carrier_permissions p WHERE p.construction_org_id=$1 AND p.vehicle_id=v.id AND p.driver_id=d.id AND p.carrier_org_id=v.organization_id AND p.carrier_org_id=d.organization_id AND p.active)));
$$;
CREATE FUNCTION direct.can_trip(tid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT EXISTS(SELECT 1 FROM direct.trips t JOIN direct.bookings b ON b.id=t.booking_id WHERE t.id=$1 AND (direct.has_scope(b.site_id,'construction') OR direct.has_scope(b.receiving_location_id,'receiving') OR direct.own_driver(t.driver_id)));
$$;
CREATE FUNCTION direct.select_trip(bid uuid,tid uuid) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; n int;
BEGIN
 IF tid IS NOT NULL THEN IF NOT EXISTS(SELECT 1 FROM direct.trips WHERE id=tid AND booking_id=bid) OR NOT direct.can_trip(tid) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF; RETURN tid; END IF;
 SELECT count(*),min(id::text)::uuid INTO n,result FROM direct.trips WHERE booking_id=bid;
 IF n>1 THEN RAISE EXCEPTION 'TRIP_ID_REQUIRED' USING ERRCODE='22023'; END IF;
 IF result IS NOT NULL AND NOT direct.can_trip(result) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF; RETURN result;
END $$;
DROP POLICY trips_read ON direct.trips; CREATE POLICY trips_read ON direct.trips FOR SELECT USING(direct.can_trip(id));
DROP POLICY events_read ON direct.trip_events;CREATE POLICY events_read ON direct.trip_events FOR SELECT USING(direct.can_trip(trip_id));
DROP POLICY actuals_read ON direct.actuals;CREATE POLICY actuals_read ON direct.actuals FOR SELECT USING(direct.can_trip(trip_id));
DROP POLICY receipt_read ON direct.receipts;CREATE POLICY receipt_read ON direct.receipts FOR SELECT USING(direct.can_trip(trip_id));
DROP POLICY receipt_history_read ON direct.receipt_history;CREATE POLICY receipt_history_read ON direct.receipt_history FOR SELECT USING(direct.can_trip(trip_id));
DROP POLICY attachments_read ON direct.attachments;CREATE POLICY attachments_read ON direct.attachments FOR SELECT USING(CASE WHEN trip_id IS NOT NULL THEN direct.can_trip(trip_id) ELSE EXISTS(SELECT 1 FROM direct.bookings b WHERE b.id=booking_id AND (direct.has_scope(b.site_id,'construction') OR direct.has_scope(b.receiving_location_id,'receiving'))) END);
DROP POLICY gate_read ON direct.gate_records;CREATE POLICY gate_read ON direct.gate_records FOR SELECT USING(direct.has_scope(location_id,'receiving') OR (trip_id IS NOT NULL AND direct.can_trip(trip_id)));
DROP POLICY driver_document_read ON direct.driver_document_fields;CREATE POLICY driver_document_read ON direct.driver_document_fields FOR SELECT USING(EXISTS(SELECT 1 FROM direct.attachments a WHERE a.id=attachment_id));
CREATE POLICY carrier_vehicle_read ON public.vehicles FOR SELECT USING(EXISTS(SELECT 1 FROM direct.carrier_permissions p WHERE p.vehicle_id=id AND p.active AND direct.can_asset(p.construction_org_id)));
CREATE POLICY carrier_driver_read ON public.drivers FOR SELECT USING(EXISTS(SELECT 1 FROM direct.carrier_permissions p WHERE p.driver_id=id AND p.active AND direct.can_asset(p.construction_org_id)));
-- Preserve old payloads for single-trip bookings; multiple-trip calls must identify the trip.
DO $$ DECLARE body text; BEGIN
 SELECT pg_get_functiondef('direct.mutate(text,uuid,jsonb)'::regprocedure) INTO body;
 body:=replace(body,'v.organization_id<>b.construction_org_id OR d.organization_id<>b.construction_org_id','NOT direct.can_dispatch(b.construction_org_id,v.id,d.id)');
 body:=replace(body,'INSERT INTO direct.trips(booking_id,vehicle_id,driver_id,rotation,planned_at,assigned_by) VALUES(bid,v.id,d.id,','INSERT INTO direct.trips(booking_id,vehicle_id,driver_id,rotation,planned_at,assigned_by,planned_quantity,unit) VALUES(bid,v.id,d.id,');
 body:=replace(body,'b.planned_at,actor) RETURNING * INTO tr','b.planned_at,actor,b.quantity,b.unit) RETURNING * INTO tr');
 body:=replace(body,'SELECT * INTO tr FROM direct.trips WHERE booking_id=bid FOR UPDATE','SELECT * INTO tr FROM direct.trips WHERE id=direct.select_trip(bid,(payload->>''tripId'')::uuid) FOR UPDATE');
 body:=replace(body,'(SELECT id FROM direct.trips WHERE booking_id=bid)','direct.select_trip(bid,(payload->>''tripId'')::uuid)');
 body:=replace(body,'IF action=''report'' THEN','IF action=''report'' THEN IF b.status<>''confirmed'' OR tr.status IN (''cancelled'',''refused'') THEN RAISE EXCEPTION ''INVALID_STATE'' USING ERRCODE=''22023''; END IF;');
 body:=replace(body,'INSERT INTO direct.trips(booking_id','IF EXISTS(SELECT 1 FROM direct.trips WHERE booking_id=bid) THEN RAISE EXCEPTION ''USE_TRIP_ADD'' USING ERRCODE=''22023''; END IF; INSERT INTO direct.trips(booking_id');
 EXECUTE body;
 SELECT pg_get_functiondef('direct.receive_mutate(text,uuid,jsonb)'::regprocedure) INTO body;
 body:=replace(body,'SELECT * INTO tr FROM direct.trips WHERE booking_id=b.id FOR UPDATE','SELECT * INTO tr FROM direct.trips WHERE id=direct.select_trip(b.id,(payload->>''tripId'')::uuid) FOR UPDATE');
 body:=replace(body,'AND booking_id=b.id AND mime','AND booking_id=b.id AND trip_id=tr.id AND mime');
 body:=replace(body,'INSERT INTO direct.gate_records(location_id,booking_id,direction','INSERT INTO direct.gate_records(trip_id,location_id,booking_id,direction');
 body:=replace(body,'VALUES(loc,b.id,payload->>''direction''','VALUES(direct.select_trip(b.id,(payload->>''tripId'')::uuid),loc,b.id,payload->>''direction''');
 body:=replace(body,'SET booking_id=b.id,status=','SET booking_id=b.id,trip_id=direct.select_trip(b.id,(payload->>''tripId'')::uuid),status=');
 EXECUTE body;
 SELECT pg_get_functiondef('direct.driver_document_submit(uuid,jsonb)'::regprocedure) INTO body;
 body:=replace(body,'WHERE booking_id=(payload->>''bookingId'')::uuid FOR UPDATE','WHERE id=direct.select_trip((payload->>''bookingId'')::uuid,(payload->>''tripId'')::uuid) FOR UPDATE');
 body:=replace(body,'SELECT * INTO rc FROM direct.receipts','IF (payload->>''expectedTripVersion'')::int IS DISTINCT FROM tr.version THEN RAISE EXCEPTION ''STALE_VERSION'' USING ERRCODE=''40001''; END IF; SELECT * INTO rc FROM direct.receipts');
 body:=replace(body,'''bookingId'',tr.booking_id,''attachmentId''','''bookingId'',tr.booking_id,''tripId'',tr.id,''attachmentId''');
 EXECUTE body;
 -- Source projection runs under definer; explicitly constrain every trip and attachment.
 SELECT pg_get_functiondef('direct.list_bookings_before_evidence()'::regprocedure) INTO body;
 body:=replace(body,'WHERE direct.can_booking(b.id)','WHERE direct.can_booking(b.id) AND (t.id IS NULL OR direct.can_trip(t.id))');
 body:=replace(body,'WHERE a.booking_id=b.id','WHERE a.booking_id=b.id AND (a.trip_id=t.id OR (a.trip_id IS NULL AND NOT direct.own_driver(t.driver_id)))');
 body:=replace(body,'''rotation'',t.rotation','''plannedQuantity'',t.planned_quantity,''unit'',t.unit,''rotation'',t.rotation');
 EXECUTE body;
 SELECT pg_get_functiondef('direct.list_bookings()'::regprocedure) INTO body;
 body:=replace(body,'WHERE g.booking_id=(item->>''id'')::uuid','WHERE g.trip_id=(item->''trip''->>''id'')::uuid');
 EXECUTE body;
END $$;
REVOKE ALL ON FUNCTION direct.can_dispatch(uuid,uuid,uuid),direct.can_trip(uuid),direct.select_trip(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION direct.can_dispatch(uuid,uuid,uuid),direct.can_trip(uuid),direct.select_trip(uuid,uuid) TO authenticated;
CREATE TABLE direct.trip_issues(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),trip_id uuid NOT NULL REFERENCES direct.trips(id),kind text NOT NULL CHECK(kind IN ('delay','not_arrived','refused')),reason text NOT NULL,status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),actor_id uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now(),resolved_by uuid REFERENCES public.profiles(id),resolved_at timestamptz,resolution text,version integer NOT NULL DEFAULT 1);
ALTER TABLE direct.trip_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY issues_read ON direct.trip_issues FOR SELECT USING(direct.can_trip(trip_id));
GRANT SELECT ON direct.trip_issues TO authenticated;
CREATE FUNCTION direct.extended_mutate(action text,key uuid,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); op direct.operations; fp text:=md5(action||payload::text); b direct.bookings; tr direct.trips; v public.vehicles; d public.drivers; issue direct.trip_issues; before_value jsonb; result jsonb; reason text:=trim(coalesce(payload->>'reason','')); when_at timestamptz; q numeric;
BEGIN
 IF actor IS NULL OR key IS NULL OR payload IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||key::text,0));
 SELECT * INTO op FROM direct.operations WHERE actor_id=actor AND operation_key=key;
 IF FOUND THEN IF op.fingerprint<>fp THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='40001'; END IF; RETURN op.result; END IF;
 SELECT * INTO b FROM direct.bookings WHERE id=(payload->>'bookingId')::uuid FOR UPDATE;
 IF b.id IS NULL OR NOT direct.can_booking(b.id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF length(reason)<1 OR length(reason)>2000 THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='22023'; END IF;
 before_value:=to_jsonb(b);
 IF action IN ('booking_change','booking_cancel','booking_reply','trip_add') THEN
  IF (payload->>'expectedVersion')::int IS DISTINCT FROM b.version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='40001'; END IF;
  IF action='booking_reply' THEN
   IF NOT direct.has_scope(b.receiving_location_id,'receiving') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
   IF b.status NOT IN ('requested','change_requested') OR payload->>'decision' NOT IN ('change_requested','rejected') OR payload->>'decision' IS NULL THEN RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE='22023'; END IF;
   UPDATE direct.bookings SET status=payload->>'decision',confirmed_by=NULL,confirmed_at=NULL,agreement_state='pending',version=version+1 WHERE id=b.id;
  ELSE
   IF NOT direct.has_scope(b.site_id,'construction') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
   IF action='booking_change' THEN
    IF b.status IN ('cancelled','rejected') OR EXISTS(SELECT 1 FROM direct.trips WHERE booking_id=b.id AND status NOT IN ('assigned','cancelled')) THEN RAISE EXCEPTION 'STARTED_TRIP_LOCKED' USING ERRCODE='22023'; END IF;
    q:=(payload->>'quantity')::numeric;when_at:=(payload->>'plannedAt')::timestamptz;
    IF q IS NULL OR q<=0 OR when_at IS NULL OR NOT isfinite(when_at) OR NOT EXISTS(SELECT 1 FROM direct.receiving_locations l JOIN direct.partner_locations p ON p.receiving_location_id=l.id WHERE l.id=(payload->>'locationId')::uuid AND p.construction_org_id=b.construction_org_id AND l.soil=payload->>'soil' AND l.unit=payload->>'unit') THEN RAISE EXCEPTION 'INVALID_CONDITIONS' USING ERRCODE='22023'; END IF;
    IF q<coalesce((SELECT sum(planned_quantity) FROM direct.trips WHERE booking_id=b.id AND status<>'cancelled'),0) THEN RAISE EXCEPTION 'TRIP_QUANTITY_EXCEEDS_BOOKING' USING ERRCODE='22023'; END IF;
    UPDATE direct.bookings SET receiving_location_id=(payload->>'locationId')::uuid,receiving_org_id=(SELECT organization_id FROM public.sites WHERE id=(payload->>'locationId')::uuid),quantity=q,soil=payload->>'soil',unit=payload->>'unit',planned_at=when_at,business_date=(when_at AT TIME ZONE 'Asia/Tokyo')::date,status='requested',agreement_state='pending',confirmed_by=NULL,confirmed_at=NULL,version=version+1 WHERE id=b.id;
    -- Existing assignment times/units cannot silently inherit changed conditions.
    UPDATE direct.trips SET status='cancelled',version=version+1 WHERE booking_id=b.id AND status='assigned';
   ELSIF action='booking_cancel' THEN
    IF b.status='cancelled' OR EXISTS(SELECT 1 FROM direct.trips WHERE booking_id=b.id AND status IN ('site_arrived','in_transit','receiver_arrived')) THEN RAISE EXCEPTION 'STARTED_TRIP_LOCKED' USING ERRCODE='22023'; END IF;
    UPDATE direct.bookings SET status='cancelled',version=version+1 WHERE id=b.id;
    UPDATE direct.trips SET status='cancelled',version=version+1 WHERE booking_id=b.id AND status='assigned';
   ELSIF action='trip_add' THEN
    IF b.status<>'confirmed' THEN RAISE EXCEPTION 'RESERVATION_NOT_CONFIRMED' USING ERRCODE='22023'; END IF;
    q:=(payload->>'quantity')::numeric; when_at:=(payload->>'plannedAt')::timestamptz;
    IF q IS NULL OR q<=0 OR when_at IS NULL OR NOT isfinite(when_at) OR (when_at AT TIME ZONE 'Asia/Tokyo')::date<>b.business_date OR q+coalesce((SELECT sum(planned_quantity) FROM direct.trips WHERE booking_id=b.id AND status NOT IN ('cancelled','refused')),0)>b.quantity THEN RAISE EXCEPTION 'TRIP_QUANTITY_EXCEEDS_BOOKING' USING ERRCODE='22023'; END IF;
    SELECT * INTO v FROM public.vehicles WHERE id=(payload->>'vehicleId')::uuid FOR UPDATE;
    SELECT * INTO d FROM public.drivers WHERE id=(payload->>'driverId')::uuid FOR UPDATE;
    IF NOT direct.can_dispatch(b.construction_org_id,v.id,d.id) OR NOT EXISTS(SELECT 1 FROM public.memberships WHERE organization_id=d.organization_id AND user_id=d.profile_id AND active AND role::text='driver') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
    IF EXISTS(SELECT 1 FROM direct.trips WHERE status NOT IN ('cancelled','refused') AND (vehicle_id=v.id OR driver_id=d.id) AND planned_at BETWEEN when_at-interval '59 minutes' AND when_at+interval '59 minutes') THEN RAISE EXCEPTION 'ASSIGNMENT_OVERLAP' USING ERRCODE='40001'; END IF;
    INSERT INTO direct.trips(booking_id,vehicle_id,driver_id,rotation,planned_at,assigned_by,planned_quantity,unit) VALUES(b.id,v.id,d.id,(SELECT coalesce(max(rotation),0)+1 FROM direct.trips WHERE vehicle_id=v.id AND (planned_at AT TIME ZONE 'Asia/Tokyo')::date=b.business_date),when_at,actor,q,b.unit) RETURNING * INTO tr;
    UPDATE direct.bookings SET version=version+1 WHERE id=b.id;
   END IF;
  END IF;
 ELSE
  SELECT * INTO tr FROM direct.trips WHERE id=direct.select_trip(b.id,(payload->>'tripId')::uuid) FOR UPDATE;
  IF tr.id IS NULL OR (payload->>'expectedVersion')::int IS DISTINCT FROM tr.version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='40001'; END IF;
  before_value:=to_jsonb(tr);
  IF action='trip_reassign' THEN
   IF NOT direct.has_scope(b.site_id,'construction') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
   IF tr.status<>'assigned' OR b.status<>'confirmed' THEN RAISE EXCEPTION 'STARTED_TRIP_LOCKED' USING ERRCODE='22023'; END IF;
   SELECT * INTO v FROM public.vehicles WHERE id=(payload->>'vehicleId')::uuid FOR UPDATE;SELECT * INTO d FROM public.drivers WHERE id=(payload->>'driverId')::uuid FOR UPDATE;
   IF NOT direct.can_dispatch(b.construction_org_id,v.id,d.id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
   IF EXISTS(SELECT 1 FROM direct.trips WHERE id<>tr.id AND status NOT IN ('cancelled','refused') AND (vehicle_id=v.id OR driver_id=d.id) AND planned_at BETWEEN tr.planned_at-interval '59 minutes' AND tr.planned_at+interval '59 minutes') THEN RAISE EXCEPTION 'ASSIGNMENT_OVERLAP' USING ERRCODE='40001'; END IF;
   UPDATE direct.trips SET vehicle_id=v.id,driver_id=d.id,version=version+1 WHERE id=tr.id;
  ELSIF action='trip_cancel' THEN
   IF NOT direct.has_scope(b.site_id,'construction') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
   IF tr.status<>'assigned' THEN RAISE EXCEPTION 'STARTED_TRIP_LOCKED' USING ERRCODE='22023'; END IF;
   UPDATE direct.trips SET status='cancelled',version=version+1 WHERE id=tr.id;
  ELSIF action='trip_issue' THEN
   IF NOT (direct.own_driver(tr.driver_id) OR direct.has_scope(b.site_id,'construction') OR direct.has_scope(b.receiving_location_id,'receiving')) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
   IF tr.status IN ('cancelled','refused','unloaded') OR payload->>'kind' IS NULL OR payload->>'kind' NOT IN ('delay','not_arrived','refused') THEN RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE='22023'; END IF;
   IF payload->>'kind' IN ('not_arrived','refused') AND NOT direct.has_scope(b.receiving_location_id,'receiving') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
   INSERT INTO direct.trip_issues(trip_id,kind,reason,actor_id) VALUES(tr.id,payload->>'kind',reason,actor) RETURNING * INTO issue;
   UPDATE direct.trips SET status=CASE WHEN payload->>'kind'='refused' THEN 'refused' ELSE status END,version=version+1 WHERE id=tr.id;
  ELSIF action='issue_resolve' THEN
   IF NOT (direct.has_scope(b.site_id,'construction') OR direct.has_scope(b.receiving_location_id,'receiving')) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
   UPDATE direct.trip_issues SET status='resolved',resolution=reason,resolved_by=actor,resolved_at=now(),version=version+1 WHERE id=(payload->>'issueId')::uuid AND trip_id=tr.id AND status='open' RETURNING * INTO issue;
   IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE='22023'; END IF;
   UPDATE direct.trips SET version=version+1 WHERE id=tr.id;
  ELSIF action='report_correct' THEN
   IF NOT direct.own_driver(tr.driver_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
   IF EXISTS(SELECT 1 FROM direct.actuals WHERE trip_id=tr.id) THEN RAISE EXCEPTION 'ACTUAL_LOCKED' USING ERRCODE='22023'; END IF;
   when_at:=(payload->>'reportedAt')::timestamptz;
   IF when_at IS NULL OR NOT isfinite(when_at) OR when_at>now()+interval '5 minutes' OR when_at<tr.created_at-interval '5 minutes' THEN RAISE EXCEPTION 'INVALID_TIME' USING ERRCODE='22023'; END IF;
   before_value:=jsonb_build_object('trip',tr,'event',(SELECT to_jsonb(e) FROM direct.trip_events e WHERE e.id=(payload->>'eventId')::uuid AND e.trip_id=tr.id));
   UPDATE direct.trip_events SET reported_at=when_at WHERE id=(payload->>'eventId')::uuid AND trip_id=tr.id;
   IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='22023'; END IF;
   UPDATE direct.trips SET version=version+1 WHERE id=tr.id;
  ELSE RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE='22023'; END IF;
 END IF;
 SELECT * INTO b FROM direct.bookings WHERE id=b.id;
 IF tr.id IS NOT NULL THEN SELECT * INTO tr FROM direct.trips WHERE id=tr.id; END IF;
 result:=jsonb_build_object('bookingId',b.id,'version',b.version,'status',b.status,'tripId',tr.id,'tripVersion',tr.version,'tripStatus',tr.status,'issueId',issue.id);
 INSERT INTO direct.audit(actor_id,action,booking_id,operation_key,before_data,after_data) VALUES(actor,action,b.id,key,before_value,jsonb_build_object('booking',b,'trip',tr,'issue',issue,'reason',reason,'reportedAt',when_at));
 INSERT INTO direct.operations VALUES(actor,key,fp,result,now());RETURN result;
END $$;
REVOKE ALL ON FUNCTION direct.extended_mutate(text,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION direct.extended_mutate(text,uuid,jsonb) TO authenticated;
