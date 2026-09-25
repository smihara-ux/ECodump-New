-- Retain duplicate detections as dismissed evidence; never count them as a second entry.
ALTER TABLE direct.gate_records DROP CONSTRAINT gate_records_status_check;
ALTER TABLE direct.gate_records ADD CONSTRAINT gate_records_status_check CHECK(status IN ('pending','confirmed','dismissed'));
DO $$ DECLARE body text; BEGIN
SELECT pg_get_functiondef('direct.receive_mutate(text,uuid,jsonb)'::regprocedure) INTO body;
body:=replace(body, 'SET booking_id=b.id,status=''confirmed'',confirmed_by=actor', 'SET booking_id=b.id,status=CASE WHEN payload->>''decision''=''dismiss'' THEN ''dismissed'' ELSE ''confirmed'' END,confirmed_by=actor');
-- An attachment previously associated with one booking cannot be disclosed to another party during reconciliation.
body:=replace(body, 'before_value:=to_jsonb(gr); loc:=gr.location_id;', 'before_value:=to_jsonb(gr); loc:=gr.location_id; IF gr.attachment_id IS NOT NULL AND gr.booking_id IS DISTINCT FROM (payload->>''bookingId'')::uuid THEN RAISE EXCEPTION ''FORBIDDEN'' USING ERRCODE=''42501''; END IF;');
EXECUTE body;
END $$;
