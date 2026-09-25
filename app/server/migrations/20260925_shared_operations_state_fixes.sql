-- Follow-up because pg_get_functiondef normalizes the text of applied functions.
DO $$ DECLARE body text;BEGIN
 SELECT pg_get_functiondef('direct.extended_mutate(text,uuid,jsonb)'::regprocedure) INTO body;
 body:=replace(body,
  'planned_at=when_at,business_date=(when_at AT TIME ZONE ''Asia/Tokyo'')::date,status=''requested'',agreement_state=''pending''',
  'planned_at=when_at,business_date=(when_at AT TIME ZONE ''Asia/Tokyo'')::date,status=''change_requested'',agreement_state=''pending''');
 body:=replace(body,
  'UPDATE direct.bookings SET status=''cancelled'',version=version+1 WHERE id=b.id;',
  'UPDATE direct.bookings SET status=CASE WHEN EXISTS(SELECT 1 FROM direct.trips t JOIN direct.actuals a ON a.trip_id=t.id WHERE t.booking_id=b.id) THEN ''partially_completed'' ELSE ''cancelled'' END,version=version+1 WHERE id=b.id;');
 EXECUTE body;
 SELECT pg_get_functiondef('direct.mutate(text,uuid,jsonb)'::regprocedure) INTO body;
 body:=replace(body,'IF b.status<>''requested'' THEN','IF b.status NOT IN (''requested'',''change_requested'') THEN');
 EXECUTE body;
END $$;
