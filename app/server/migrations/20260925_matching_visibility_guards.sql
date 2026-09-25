-- Keep publication an explicit projection, never an arbitrary JSON passthrough.
DO $$ DECLARE body text; BEGIN
SELECT pg_get_functiondef('direct.match_view(uuid,boolean)'::regprocedure) INTO body;
IF strpos(body,'d:=c.data-''internal''-''documents'';')=0 THEN RAISE EXCEPTION 'match_view source changed'; END IF;
body:=replace(body,'d:=c.data-''internal''-''documents'';', 'SELECT coalesce(jsonb_object_agg(k,v),''{}''::jsonb) INTO d FROM jsonb_each(c.data) AS fields(k,v) WHERE k IN (''title'',''region'',''soil'',''quantity'',''unit'',''start'',''end'',''public'',''shared'');');
EXECUTE body;
SELECT pg_get_functiondef('direct.match_validate(jsonb,boolean)'::regprocedure) INTO body;
body:=replace(body,'FOR doc IN SELECT * FROM jsonb_array_elements(d->''documents'') LOOP',
'IF (SELECT count(*)<>count(DISTINCT x->>''id'') FROM jsonb_array_elements(d->''documents'') x) THEN RAISE EXCEPTION ''DUPLICATE_DOCUMENT_ID'' USING ERRCODE=''22023''; END IF;
FOR doc IN SELECT * FROM jsonb_array_elements(d->''documents'') LOOP
IF coalesce(doc->>''id'','''') !~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'' OR EXISTS(SELECT 1 FROM jsonb_object_keys(doc) k WHERE k NOT IN (''id'',''name'',''mime'',''base64'',''visibility'')) THEN RAISE EXCEPTION ''INVALID_DOCUMENT_FIELDS'' USING ERRCODE=''22023''; END IF;');
EXECUTE body;
END $$;
