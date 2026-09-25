-- Qualify the local result through a PL/pgSQL block label.
DO $$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('direct.driver_document_submit(uuid,jsonb)'::regprocedure);
 definition:=replace(definition,'DECLARE actor uuid',E'<<document_submission>>\nDECLARE actor uuid');
 definition:=replace(definition,'result=driver_document_submit.result','result=document_submission.result');
 EXECUTE definition;
END $$;
