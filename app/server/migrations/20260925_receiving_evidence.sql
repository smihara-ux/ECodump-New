-- Receiving evidence: original documents are immutable; every review has a journal.
CREATE TABLE direct.receipts (
 trip_id uuid PRIMARY KEY REFERENCES direct.trips(id), attachment_id uuid NOT NULL REFERENCES direct.attachments(id),
 quantity numeric(12,3) NOT NULL CHECK(quantity>0 AND quantity<1000000000), unit text NOT NULL CHECK(unit IN ('m3','t')),
 status text NOT NULL CHECK(status IN ('pending','returned','confirmed')), version integer NOT NULL DEFAULT 1,
 submitted_by uuid NOT NULL REFERENCES public.profiles(id), submitted_at timestamptz NOT NULL DEFAULT now(),
 source text NOT NULL CHECK(source IN ('driver','receiver_transcription')), confirmed_by uuid REFERENCES public.profiles(id), confirmed_at timestamptz, reason text NOT NULL DEFAULT ''
);
CREATE TABLE direct.receipt_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trip_id uuid NOT NULL REFERENCES direct.trips(id), action text NOT NULL,
 actor_id uuid NOT NULL REFERENCES public.profiles(id), recorded_at timestamptz NOT NULL DEFAULT now(),
 before_data jsonb, after_data jsonb NOT NULL, reason text NOT NULL, operation_key uuid NOT NULL
);
CREATE TABLE direct.gate_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), location_id uuid NOT NULL REFERENCES direct.receiving_locations(id),
 booking_id uuid REFERENCES direct.bookings(id), direction text NOT NULL CHECK(direction IN ('entry','exit')),
 occurred_at timestamptz NOT NULL, plate text NOT NULL CHECK(length(trim(plate)) BETWEEN 1 AND 80),
 issue text NOT NULL CHECK(issue IN ('none','unread','unregistered','unexpected','duplicate')),
 status text NOT NULL CHECK(status IN ('pending','confirmed')), source text NOT NULL DEFAULT 'human' CHECK(source='human'),
 attachment_id uuid REFERENCES direct.attachments(id), actor_id uuid NOT NULL REFERENCES public.profiles(id),
 confirmed_by uuid REFERENCES public.profiles(id), confirmed_at timestamptz, reason text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1
);
ALTER TABLE direct.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct.receipt_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct.gate_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY receipt_read ON direct.receipts FOR SELECT USING(EXISTS(SELECT 1 FROM direct.trips t WHERE t.id=trip_id AND direct.can_booking(t.booking_id)));
CREATE POLICY receipt_history_read ON direct.receipt_history FOR SELECT USING(EXISTS(SELECT 1 FROM direct.trips t WHERE t.id=trip_id AND direct.can_booking(t.booking_id)));
CREATE POLICY gate_read ON direct.gate_records FOR SELECT USING(direct.has_scope(location_id,'receiving') OR (booking_id IS NOT NULL AND direct.can_booking(booking_id)));
REVOKE ALL ON direct.receipts,direct.receipt_history,direct.gate_records FROM PUBLIC,anon,authenticated;
GRANT SELECT ON direct.receipts,direct.receipt_history,direct.gate_records TO authenticated;

CREATE FUNCTION direct.receive_mutate(action text, key uuid, payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); oldop direct.operations; b direct.bookings; tr direct.trips; rc direct.receipts; gr direct.gate_records;
 before_value jsonb; result jsonb; fp text:=md5(action||payload::text); aid uuid; loc uuid; q numeric; u text; why text:=trim(coalesce(payload->>'reason',''));
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.memberships WHERE user_id=actor AND active) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF key IS NULL OR payload IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||key::text,0));
 SELECT * INTO oldop FROM direct.operations WHERE actor_id=actor AND operation_key=key;
 IF FOUND THEN IF oldop.fingerprint<>fp THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='40001'; END IF; RETURN oldop.result; END IF;
 IF action IN ('gate_record','gate_review') THEN
   IF action='gate_review' THEN
     SELECT * INTO gr FROM direct.gate_records WHERE id=(payload->>'recordId')::uuid FOR UPDATE;
     IF NOT FOUND OR NOT direct.has_scope(gr.location_id,'receiving') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
     IF (payload->>'expectedVersion')::int IS DISTINCT FROM gr.version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='40001'; END IF;
     IF gr.status<>'pending' OR length(why)<1 THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='22023'; END IF;
     before_value:=to_jsonb(gr); loc:=gr.location_id;
   ELSE
     loc:=(payload->>'locationId')::uuid;
     IF NOT direct.has_scope(loc,'receiving') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
   END IF;
   SELECT * INTO b FROM direct.bookings WHERE id=nullif(payload->>'bookingId','')::uuid FOR UPDATE;
   IF payload->>'bookingId' IS NOT NULL AND (b.id IS NULL OR b.receiving_location_id<>loc OR NOT direct.has_scope(loc,'receiving')) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
   IF action='gate_review' THEN
     IF b.id IS NULL OR NOT EXISTS(SELECT 1 FROM direct.trips WHERE booking_id=b.id) THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='22023'; END IF;
     UPDATE direct.gate_records SET booking_id=b.id,status='confirmed',confirmed_by=actor,confirmed_at=now(),reason=why,version=version+1 WHERE id=gr.id RETURNING * INTO gr;
   ELSE
     IF (payload->>'occurredAt') IS NULL OR NOT isfinite((payload->>'occurredAt')::timestamptz) OR (payload->>'occurredAt')::timestamptz>now()+interval '5 minutes' THEN RAISE EXCEPTION 'INVALID_TIME' USING ERRCODE='22023'; END IF;
     aid:=nullif(payload->>'attachmentId','')::uuid;
     IF aid IS NOT NULL AND (b.id IS NULL OR NOT EXISTS(SELECT 1 FROM direct.attachments WHERE id=aid AND booking_id=b.id)) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
     INSERT INTO direct.gate_records(location_id,booking_id,direction,occurred_at,plate,issue,status,attachment_id,actor_id,confirmed_by,confirmed_at,reason)
     VALUES(loc,b.id,payload->>'direction',(payload->>'occurredAt')::timestamptz,payload->>'plate',payload->>'issue','pending',aid,actor,NULL,NULL,why) RETURNING * INTO gr;
   END IF;
   result:=jsonb_build_object('recordId',gr.id,'bookingId',gr.booking_id,'version',gr.version,'status',gr.status);
   -- Unmatched records remain location-scoped; history for those is stored separately.
   INSERT INTO direct.gate_history(record_id,actor_id,before_data,after_data,reason,operation_key) VALUES(gr.id,actor,before_value,to_jsonb(gr),why,key);
 ELSE
   SELECT * INTO b FROM direct.bookings WHERE id=(payload->>'bookingId')::uuid FOR UPDATE;
   IF b.id IS NULL OR NOT direct.can_booking(b.id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
   SELECT * INTO tr FROM direct.trips WHERE booking_id=b.id FOR UPDATE;
   IF tr.id IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='22023'; END IF;
   SELECT * INTO rc FROM direct.receipts WHERE trip_id=tr.id FOR UPDATE;
   before_value:=CASE WHEN rc.trip_id IS NULL THEN NULL ELSE to_jsonb(rc) END;
   IF (payload->>'expectedVersion')::int IS DISTINCT FROM coalesce(rc.version,0) THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='40001'; END IF;
   IF action='receipt_submit' THEN
     IF NOT (direct.own_driver(tr.driver_id) OR direct.has_scope(b.receiving_location_id,'receiving')) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
     IF rc.status='confirmed' OR EXISTS(SELECT 1 FROM direct.actuals WHERE trip_id=tr.id) THEN RAISE EXCEPTION 'ACTUAL_LOCKED' USING ERRCODE='22023'; END IF;
     aid:=(payload->>'attachmentId')::uuid;
     IF aid IS NULL OR NOT EXISTS(SELECT 1 FROM direct.attachments WHERE id=aid AND booking_id=b.id AND mime IN ('image/jpeg','image/png')) THEN RAISE EXCEPTION 'INVALID_ORIGINAL' USING ERRCODE='22023'; END IF;
     q:=(payload->>'quantity')::numeric; u:=payload->>'unit';
     IF q IS NULL OR q<=0 OR q>=1000000000 OR u IS NULL OR u NOT IN ('m3','t') THEN RAISE EXCEPTION 'INVALID_ACTUAL' USING ERRCODE='22023'; END IF;
     IF rc.trip_id IS NOT NULL AND length(why)<1 THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='22023'; END IF;
     INSERT INTO direct.receipts(trip_id,attachment_id,quantity,unit,status,submitted_by,source,reason)
     VALUES(tr.id,aid,q,u,'pending',actor,CASE WHEN direct.own_driver(tr.driver_id) THEN 'driver' ELSE 'receiver_transcription' END,why)
     ON CONFLICT(trip_id) DO UPDATE SET attachment_id=aid,quantity=q,unit=u,status='pending',version=direct.receipts.version+1,submitted_by=actor,submitted_at=now(),source=excluded.source,reason=why RETURNING * INTO rc;
   ELSE
     IF NOT direct.has_scope(b.receiving_location_id,'receiving') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
     IF rc.trip_id IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='22023'; END IF;
     IF action='receipt_return' THEN
       IF rc.status<>'pending' OR length(why)<1 THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='22023'; END IF;
       UPDATE direct.receipts SET status='returned',version=version+1,reason=why WHERE trip_id=tr.id RETURNING * INTO rc;
     ELSIF action IN ('receipt_confirm','receipt_correct') THEN
       IF tr.status<>'unloaded' THEN RAISE EXCEPTION 'UNLOAD_REQUIRED' USING ERRCODE='22023'; END IF;
       IF (action='receipt_confirm' AND rc.status<>'pending') OR (action='receipt_correct' AND rc.status<>'confirmed') THEN RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE='22023'; END IF;
       IF payload->>'originalChecked' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'ORIGINAL_CHECK_REQUIRED' USING ERRCODE='22023'; END IF;
       q:=(payload->>'quantity')::numeric;u:=payload->>'unit';
       IF q IS NULL OR q<=0 OR q>=1000000000 OR u IS NULL OR u NOT IN ('m3','t') THEN RAISE EXCEPTION 'INVALID_ACTUAL' USING ERRCODE='22023'; END IF;
       IF (action='receipt_correct' OR q<>rc.quantity OR u<>rc.unit OR q<>b.quantity OR u<>b.unit) AND length(why)<1 THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='22023'; END IF;
       IF action='receipt_confirm' THEN
         INSERT INTO direct.actuals(trip_id,quantity,unit,difference_reason,confirmed_by) VALUES(tr.id,q,u,why,actor);
       ELSE
         UPDATE direct.actuals SET quantity=q,unit=u,difference_reason=why,confirmed_by=actor,confirmed_at=now() WHERE trip_id=tr.id;
       END IF;
       UPDATE direct.trips SET version=version+1 WHERE id=tr.id;
       UPDATE direct.receipts SET quantity=q,unit=u,status='confirmed',confirmed_by=actor,confirmed_at=now(),version=version+1,reason=why WHERE trip_id=tr.id RETURNING * INTO rc;
     ELSE RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE='22023'; END IF;
   END IF;
   INSERT INTO direct.receipt_history(trip_id,action,actor_id,before_data,after_data,reason,operation_key) VALUES(tr.id,action,actor,before_value,to_jsonb(rc),why,key);
   result:=jsonb_build_object('bookingId',b.id,'version',rc.version,'status',rc.status);
   INSERT INTO direct.audit(actor_id,action,booking_id,operation_key,before_data,after_data) VALUES(actor,action,b.id,key,before_value,to_jsonb(rc));
 END IF;
 INSERT INTO direct.operations(actor_id,operation_key,fingerprint,result) VALUES(actor,key,fp,result);
 RETURN result;
END $$;
CREATE TABLE direct.gate_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),record_id uuid NOT NULL REFERENCES direct.gate_records(id),actor_id uuid NOT NULL REFERENCES public.profiles(id),recorded_at timestamptz NOT NULL DEFAULT now(),before_data jsonb,after_data jsonb NOT NULL,reason text NOT NULL,operation_key uuid NOT NULL);
ALTER TABLE direct.gate_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY gate_history_read ON direct.gate_history FOR SELECT USING(EXISTS(SELECT 1 FROM direct.gate_records g WHERE g.id=record_id));
REVOKE ALL ON direct.gate_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON direct.gate_history TO authenticated;
REVOKE ALL ON FUNCTION direct.receive_mutate(text,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION direct.receive_mutate(text,uuid,jsonb) TO authenticated;
-- Preserve existing API compatibility, but an attached receipt must follow its checked review path.
DO $$ DECLARE body text; BEGIN
SELECT pg_get_functiondef('direct.mutate(text,uuid,jsonb)'::regprocedure) INTO body;
body:=replace(body, 'IF tr.status<>''unloaded'' THEN', 'IF EXISTS(SELECT 1 FROM direct.receipts WHERE trip_id=tr.id) THEN RAISE EXCEPTION ''RECEIPT_REVIEW_REQUIRED'' USING ERRCODE=''22023''; END IF; IF tr.status<>''unloaded'' THEN');
EXECUTE body;
END $$;
ALTER FUNCTION direct.list_bookings() RENAME TO list_bookings_before_evidence;
CREATE FUNCTION direct.list_bookings() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT coalesce(jsonb_agg(item || jsonb_build_object(
 'receiptRecord',(SELECT to_jsonb(r)||jsonb_build_object('confirmedName',p.display_name) FROM direct.receipts r LEFT JOIN public.profiles p ON p.id=r.confirmed_by WHERE r.trip_id=(item->'trip'->>'id')::uuid),
 'receiptHistory',coalesce((SELECT jsonb_agg(to_jsonb(h)||jsonb_build_object('actorName',p.display_name) ORDER BY h.recorded_at) FROM direct.receipt_history h JOIN public.profiles p ON p.id=h.actor_id WHERE h.trip_id=(item->'trip'->>'id')::uuid),'[]'::jsonb),
 'gateRecords',coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.occurred_at) FROM direct.gate_records g WHERE g.booking_id=(item->>'id')::uuid),'[]'::jsonb),
 'vehicleCompany',(SELECT o.name FROM public.vehicles v JOIN public.organizations o ON o.id=v.organization_id WHERE v.id=(item->'trip'->>'vehicleId')::uuid)
)),'[]'::jsonb) FROM jsonb_array_elements(direct.list_bookings_before_evidence()) item WHERE direct.can_booking((item->>'id')::uuid); $$;
REVOKE ALL ON FUNCTION direct.list_bookings() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION direct.list_bookings() TO authenticated;
