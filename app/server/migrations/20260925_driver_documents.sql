-- Driver photo + manual transcription. Reuses receiving evidence without changing review authority.
CREATE TABLE direct.driver_document_fields (
 attachment_id uuid PRIMARY KEY REFERENCES direct.attachments(id), booking_id uuid NOT NULL REFERENCES direct.bookings(id),
 fields jsonb NOT NULL, submitted_by uuid NOT NULL REFERENCES public.profiles(id), submitted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE direct.driver_document_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY driver_document_read ON direct.driver_document_fields FOR SELECT USING(direct.can_booking(booking_id));
REVOKE ALL ON direct.driver_document_fields FROM PUBLIC,anon,authenticated;
GRANT SELECT ON direct.driver_document_fields TO authenticated;
CREATE FUNCTION direct.driver_document_submit(key uuid,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); tr direct.trips; rc direct.receipts; op direct.operations; aid uuid; result jsonb; bytes bytea; f jsonb:=payload->'fields'; fp text:=md5('driver_document_submit'||payload::text);
BEGIN
 IF actor IS NULL OR key IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||key::text,0));
 SELECT * INTO op FROM direct.operations WHERE actor_id=actor AND operation_key=key;
 IF FOUND THEN IF op.fingerprint<>fp THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='40001'; END IF; RETURN op.result; END IF;
 SELECT * INTO tr FROM direct.trips WHERE booking_id=(payload->>'bookingId')::uuid FOR UPDATE;
 IF tr.id IS NULL OR NOT direct.own_driver(tr.driver_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 SELECT * INTO rc FROM direct.receipts WHERE trip_id=tr.id;
 IF rc.trip_id IS NOT NULL AND rc.status<>'returned' THEN RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE='22023'; END IF;
 IF f IS NULL OR jsonb_typeof(f)<>'object' OR length(f::text)>8000 OR coalesce(length(trim(f->>'item')),0)<1 OR coalesce(length(trim(f->>'plate')),0)<1 OR coalesce(length(trim(f->>'origin')),0)<1 OR coalesce(length(trim(f->>'destination')),0)<1 OR (coalesce(length(trim(f->>'number')),0)=0 AND coalesce(length(trim(f->>'missingNumberReason')),0)=0) OR f->>'checked' IS DISTINCT FROM 'true' OR f->>'date' IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='22023'; END IF;
 IF NOT isfinite((f->>'date')::date) THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='22023'; END IF;
 bytes:=decode(payload->>'base64','base64');
 IF bytes IS NULL OR octet_length(bytes)>2097152 OR NOT ((payload->>'mime'='image/png' AND substring(bytes from 1 for 8)=decode('89504e470d0a1a0a','hex')) OR (payload->>'mime'='image/jpeg' AND substring(bytes from 1 for 3)=decode('ffd8ff','hex'))) THEN RAISE EXCEPTION 'INVALID_ORIGINAL' USING ERRCODE='22023'; END IF;
 INSERT INTO direct.attachments(booking_id,trip_id,uploaded_by,filename,mime,data) VALUES(tr.booking_id,tr.id,actor,payload->>'filename',payload->>'mime',bytes) RETURNING id INTO aid;
 result:=direct.receive_mutate('receipt_submit',key,jsonb_build_object('bookingId',tr.booking_id,'attachmentId',aid,'quantity',payload->'quantity','unit',payload->>'unit','expectedVersion',payload->'expectedVersion','reason',coalesce(payload->>'reason','')));
 INSERT INTO direct.driver_document_fields(attachment_id,booking_id,fields,submitted_by) VALUES(aid,tr.booking_id,f,actor);
 result:=result||jsonb_build_object('attachmentId',aid);
 UPDATE direct.operations SET fingerprint=fp,result=driver_document_submit.result WHERE actor_id=actor AND operation_key=key;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION direct.driver_document_submit(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION direct.driver_document_submit(uuid,jsonb) TO authenticated;
CREATE FUNCTION direct.driver_identity() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('companies',coalesce((SELECT jsonb_agg(o.name) FROM public.memberships m JOIN public.organizations o ON o.id=m.organization_id WHERE m.user_id=auth.uid() AND m.active AND m.role::text='driver'),'[]'::jsonb),'vehicles',coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object('id',v.id,'plate',v.registration_number)) FROM direct.trips t JOIN public.vehicles v ON v.id=t.vehicle_id WHERE direct.own_driver(t.driver_id)),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION direct.driver_identity() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION direct.driver_identity() TO authenticated;
