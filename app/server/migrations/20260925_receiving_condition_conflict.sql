-- A stale conditions form is a version conflict, not an input validation error.
DO $$ DECLARE body text;BEGIN
 SELECT pg_get_functiondef('direct.location_mutate(text,uuid,jsonb)'::regprocedure) INTO body;
 body:=replace(body,
  'IF (payload->>''expectedVersion'')::integer IS DISTINCT FROM c.version OR payload->>''unit'' NOT IN (''m3'',''t'')',
  'IF (payload->>''expectedVersion'')::integer IS DISTINCT FROM c.version THEN RAISE EXCEPTION ''STALE_VERSION'' USING ERRCODE=''40001'';END IF; IF payload->>''unit'' NOT IN (''m3'',''t'')');
 EXECUTE body;
END $$;

