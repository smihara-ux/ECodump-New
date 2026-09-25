ALTER TABLE direct.match_consultations ADD COLUMN initial_message text NOT NULL DEFAULT '';
CREATE FUNCTION direct.match_snapshot(cid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT direct.match_view(cid,true)||jsonb_build_object('documents',coalesce((SELECT jsonb_agg(doc) FROM direct.match_cases c,jsonb_array_elements(c.data->'documents') doc WHERE c.id=cid AND doc->>'visibility' IN ('public','shared')),'[]'::jsonb)) $$;
REVOKE ALL ON FUNCTION direct.match_snapshot(uuid) FROM PUBLIC,authenticated,anon;
DO $$ DECLARE body text; BEGIN
SELECT pg_get_functiondef('direct.match_mutate(text,uuid,jsonb)'::regprocedure) INTO body;
body:=replace(body,'result:=jsonb_build_object(''consultationId'',co.id);', 'UPDATE direct.match_consultations SET initial_message=left(coalesce(p->>''message'',''''),5000) WHERE id=co.id; result:=jsonb_build_object(''consultationId'',co.id);');
body:=replace(body,'direct.match_view(s.id,true),direct.match_view(dest.id,true)','direct.match_snapshot(s.id),direct.match_snapshot(dest.id)');
body:=replace(body,'d:=agr.snapshot->''terms''; bid:=gen_random_uuid();', 'd:=agr.snapshot->''terms''; bid:=gen_random_uuid(); IF (p->>''plannedAt'') IS NULL OR ((p->>''plannedAt'')::timestamptz AT TIME ZONE ''Asia/Tokyo'')::date NOT BETWEEN (d->>''start'')::date AND (d->>''end'')::date THEN RAISE EXCEPTION ''INVALID_RESERVATION_TIME'' USING ERRCODE=''22023''; END IF;');
body:=replace(body,'(d->>''start'')::date,((d->>''start'')||''T09:00:00+09:00'')::timestamptz','((p->>''plannedAt'')::timestamptz AT TIME ZONE ''Asia/Tokyo'')::date,(p->>''plannedAt'')::timestamptz');
EXECUTE body;
SELECT pg_get_functiondef('direct.match_list(text,jsonb)'::regprocedure) INTO body;
body:=replace(body,'''state'',co.state,','''state'',co.state,''initialMessage'',co.initial_message,');
EXECUTE body;
SELECT pg_get_functiondef('direct.match_validate(jsonb,boolean)'::regprocedure) INTO body;
body:=replace(body,'IF NOT terms_only THEN', 'IF NOT terms_only THEN IF jsonb_typeof(d->''public'') IS DISTINCT FROM ''string'' OR jsonb_typeof(d->''shared'') IS DISTINCT FROM ''string'' OR jsonb_typeof(d->''internal'') IS DISTINCT FROM ''string'' OR length(d->>''public'')>5000 OR length(d->>''shared'')>5000 OR length(d->>''internal'')>5000 THEN RAISE EXCEPTION ''INVALID_TEXT'' USING ERRCODE=''22023''; END IF;');
EXECUTE body;
END $$;
-- Do not expose commercial agreement text to drivers through audit before-images.
DROP POLICY audit_read ON direct.audit;
CREATE POLICY audit_read ON direct.audit FOR SELECT USING(EXISTS(SELECT 1 FROM direct.bookings b WHERE b.id=booking_id AND (direct.has_scope(b.site_id,'construction') OR direct.has_scope(b.receiving_location_id,'receiving'))));
