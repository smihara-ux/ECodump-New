-- Explicit trip/version is required for multiple trips, while one-trip legacy
-- payloads remain valid during migration.
DO $$ DECLARE body text;BEGIN
 SELECT pg_get_functiondef('direct.driver_document_submit(uuid,jsonb)'::regprocedure) INTO body;
 body:=replace(body,
  'IF (payload->>''expectedTripVersion'')::int IS DISTINCT FROM tr.version THEN',
  'IF payload ? ''expectedTripVersion'' AND (payload->>''expectedTripVersion'')::int IS DISTINCT FROM tr.version THEN');
 EXECUTE body;
END $$;
