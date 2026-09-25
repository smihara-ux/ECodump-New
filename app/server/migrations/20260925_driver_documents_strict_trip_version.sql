-- Once trip-aware clients are available, every driver document write must carry
-- the exact assignment version. This blocks stale submissions after reassignment.
DO $$ DECLARE body text;BEGIN
 SELECT pg_get_functiondef('direct.driver_document_submit(uuid,jsonb)'::regprocedure) INTO body;
 body:=replace(body,
  'IF payload ? ''expectedTripVersion'' AND (payload->>''expectedTripVersion'')::int IS DISTINCT FROM tr.version THEN',
  'IF (payload->>''expectedTripVersion'')::int IS DISTINCT FROM tr.version THEN');
 EXECUTE body;
END $$;

